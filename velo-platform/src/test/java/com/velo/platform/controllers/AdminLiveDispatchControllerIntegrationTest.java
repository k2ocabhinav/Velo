package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.PointDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.AdminDispatchService;
import com.velo.platform.utils.GeometryUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.nullValue;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class AdminLiveDispatchControllerIntegrationTest {

    private static final AtomicLong EMAIL_SEQUENCE = new AtomicLong();
    private static final double LAT = 12.9716;
    private static final double LNG = 77.5946;

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private RideRequestRepository rideRequestRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private AdminDispatchService adminDispatchService;

    @Test
    void liveSnapshot_ShouldReturnTenantScopedDriversAndOpenRidesWithExpectedShape() throws Exception {
        LocalDateTime now = LocalDateTime.now();
        Driver available = persistDriver("Available", 1L, true, true, now.minusSeconds(20));
        Driver confirmed = persistDriver("Confirmed", 1L, false, false, now.minusSeconds(75));
        Driver ongoing = persistDriver("Ongoing", 1L, false, false, now.minusSeconds(30));
        persistDriver("Unavailable", 1L, false, false, now.minusSeconds(10));
        persistDriver("Stale", 1L, true, false, now.minusMinutes(16));
        persistDriver("No timestamp", 1L, true, false, null);
        Driver suspended = persistDriver("Suspended", 1L, true, false, now.minusSeconds(10));
        suspended.setOnboardingStatus(DriverOnboardingStatus.SUSPENDED);
        driverRepository.save(suspended);
        persistDriver("Other tenant", 2L, true, false, now.minusSeconds(10));

        Rider simulatedRider = persistRider("Simulated", 1L, true);
        Rider realRider = persistRider("Real", 1L, false);
        RideRequest pending = persistRequest(simulatedRider, RideRequestStatus.PENDING, "Airport", "MG Road");
        RideRequest confirmedRequest = persistRequest(realRider, RideRequestStatus.CONFIRMED, "Hotel", "Office");
        RideRequest ongoingRequest = persistRequest(realRider, RideRequestStatus.CONFIRMED, "Station", "Hotel");
        persistRide(confirmedRequest, confirmed, RideStatus.CONFIRMED, null);
        persistRide(ongoingRequest, ongoing, RideStatus.ONGOING, now.minusMinutes(4));
        RideRequest otherTenantRequest = RideRequest.builder()
                .tenantId(2L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .rider(persistRider("Other tenant rider", 2L, false))
                .build();
        rideRequestRepository.save(otherTenantRequest);

        mockMvc.perform(withAdmin(get("/api/v1/admin/dispatch/live")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.data.generatedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.drivers.length()").value(3))
                .andExpect(jsonPath("$.data.drivers[0].driverId").value(available.getId()))
                .andExpect(jsonPath("$.data.drivers[0].name").value("Available Test"))
                .andExpect(jsonPath("$.data.drivers[0].vehiclePlate").value("KA01AA0001"))
                .andExpect(jsonPath("$.data.drivers[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$.data.drivers[0].simulated").value(true))
                .andExpect(jsonPath("$.data.drivers[0].heading").value(85.0))
                .andExpect(jsonPath("$.data.drivers[0].speedKph").value(32.5))
                .andExpect(jsonPath("$.data.drivers[0].stale").value(false))
                .andExpect(jsonPath("$.data.drivers[1].driverId").value(confirmed.getId()))
                .andExpect(jsonPath("$.data.drivers[1].status").value("EN_ROUTE_TO_PICKUP"))
                .andExpect(jsonPath("$.data.drivers[1].stale").value(true))
                .andExpect(jsonPath("$.data.drivers[1].rideId").isNotEmpty())
                .andExpect(jsonPath("$.data.drivers[2].driverId").value(ongoing.getId()))
                .andExpect(jsonPath("$.data.drivers[2].status").value("ON_TRIP"))
                .andExpect(jsonPath("$.data.rides.length()").value(3))
                .andExpect(jsonPath("$.data.rides[0].rideId").value(nullValue()))
                .andExpect(jsonPath("$.data.rides[0].rideRequestId").value(pending.getId()))
                .andExpect(jsonPath("$.data.rides[0].status").value("REQUESTED"))
                .andExpect(jsonPath("$.data.rides[0].simulated").value(true))
                .andExpect(jsonPath("$.data.rides[0].pickup.address").value("Airport"))
                .andExpect(jsonPath("$.data.rides[0].dropOff.address").value("MG Road"))
                .andExpect(jsonPath("$.data.rides[0].pickup.lat").value(LAT))
                .andExpect(jsonPath("$.data.rides[1].status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.rides[2].status").value("ONGOING"));
    }

    @Test
    void liveSnapshot_WithTwoHundredDrivers_ShouldCompleteWithinFiftyMilliseconds() {
        List<User> users = new ArrayList<>(200);
        for (int index = 0; index < 200; index++) {
            users.add(newUser("Perf" + index, 1L, false, Role.DRIVER));
        }
        users = userRepository.saveAll(users);
        LocalDateTime locationTime = LocalDateTime.now().minusSeconds(10);
        List<Driver> drivers = new ArrayList<>(200);
        for (User user : users) {
            drivers.add(Driver.builder()
                    .user(user)
                    .tenantId(1L)
                    .vehicleId("PERF-" + user.getId())
                    .rating(4.5)
                    .available(true)
                    .onboardingStatus(DriverOnboardingStatus.APPROVED)
                    .currentLocation(point())
                    .locationUpdatedAt(locationTime)
                    .build());
        }
        driverRepository.saveAllAndFlush(drivers);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(1L, "admin@test.com", "ADMIN", 1L),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        ));
        SecurityContextHolder.setContext(context);
        try {
            adminDispatchService.getLiveDispatch();
            long startedAt = System.nanoTime();
            var snapshot = adminDispatchService.getLiveDispatch();
            long elapsedNanos = System.nanoTime() - startedAt;

            assertThat(snapshot.drivers()).hasSize(200);
            assertThat(elapsedNanos).isLessThan(50_000_000L);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private MockHttpServletRequestBuilder withAdmin(MockHttpServletRequestBuilder builder) {
        return builder.header("X-Test-User-Id", "1")
                .header("X-Test-Email", "admin@test.com")
                .header("X-Test-Role", "ADMIN");
    }

    private Driver persistDriver(String firstName, Long tenantId, boolean available, boolean simulated, LocalDateTime locationUpdatedAt) {
        User user = userRepository.save(newUser(firstName, tenantId, simulated, Role.DRIVER));
        return driverRepository.saveAndFlush(Driver.builder()
                .user(user)
                .tenantId(tenantId)
                .vehicleId("KA01AA" + String.format("%04d", user.getId()))
                .rating(4.8)
                .available(available)
                .onboardingStatus(DriverOnboardingStatus.APPROVED)
                .currentLocation(point())
                .locationUpdatedAt(locationUpdatedAt)
                .locationHeading(85.0)
                .locationSpeedKph(32.5)
                .build());
    }

    private Rider persistRider(String firstName, Long tenantId, boolean simulated) {
        User user = userRepository.save(newUser(firstName, tenantId, simulated, Role.RIDER));
        return riderRepository.saveAndFlush(Rider.builder().user(user).tenantId(tenantId).rating(4.8).build());
    }

    private RideRequest persistRequest(Rider rider, RideRequestStatus status, String pickupAddress, String dropOffAddress) {
        return rideRequestRepository.saveAndFlush(RideRequest.builder()
                .tenantId(rider.getTenantId())
                .rider(rider)
                .rideRequestStatus(status)
                .pickupLocation(point())
                .dropOffLocation(point())
                .pickupAddress(pickupAddress)
                .dropOffAddress(dropOffAddress)
                .fare(new BigDecimal("74.28"))
                .build());
    }

    private Ride persistRide(RideRequest request, Driver driver, RideStatus status, LocalDateTime startedAt) {
        return rideRepository.saveAndFlush(Ride.builder()
                .tenantId(request.getTenantId())
                .rideRequest(request)
                .rider(request.getRider())
                .driver(driver)
                .rideStatus(status)
                .pickupLocation(request.getPickupLocation())
                .dropOffLocation(request.getDropOffLocation())
                .fare(request.getFare())
                .startedAt(startedAt)
                .build());
    }

    private User newUser(String firstName, Long tenantId, boolean simulated, Role role) {
        long sequence = EMAIL_SEQUENCE.incrementAndGet();
        return User.builder()
                .firstName(firstName)
                .lastName("Test")
                .email("live-" + sequence + "@test.com")
                .password("password123")
                .tenantId(tenantId)
                .simulated(simulated)
                .roles(Set.of(role))
                .build();
    }

    private org.locationtech.jts.geom.Point point() {
        return GeometryUtil.createPoint(new PointDto(new double[]{LNG, LAT}));
    }
}
