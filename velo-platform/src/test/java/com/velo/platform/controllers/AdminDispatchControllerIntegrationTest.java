package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.AdminDispatchAudit;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.AdminDispatchActionType;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.RideOfferStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.repositories.AdminDispatchAuditRepository;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideOfferRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class AdminDispatchControllerIntegrationTest {

    private static final AtomicLong EMAIL_SEQUENCE = new AtomicLong();

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private RideRequestRepository rideRequestRepository;
    @Autowired private RideOfferRepository rideOfferRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private AdminDispatchAuditRepository adminDispatchAuditRepository;

    private User adminUser;
    private Rider rider;
    private Driver primaryDriver;
    private Driver secondaryDriver;
    private Driver suspendedDriver;
    private RideRequest pendingRequest;
    private Ride activeRide;

    @BeforeEach
    void setUp() {
        adminDispatchAuditRepository.deleteAll();
        rideOfferRepository.deleteAll();
        rideRepository.deleteAll();
        rideRequestRepository.deleteAll();
        driverRepository.deleteAll();
        riderRepository.deleteAll();
        userRepository.deleteAll();

        adminUser = createUser("admin.dispatch@test.com", Role.ADMIN);

        User riderUser = createUser("dispatch.rider@test.com", Role.RIDER);
        rider = riderRepository.save(Rider.builder()
                .user(riderUser)
                .rating(4.8)
                .build());

        User primaryDriverUser = createUser("dispatch.driver.primary@test.com", Role.DRIVER);
        primaryDriver = driverRepository.save(Driver.builder()
                .user(primaryDriverUser)
                .vehicleId("KA01AA1111")
                .rating(4.7)
                .available(true)
                .onboardingStatus(DriverOnboardingStatus.APPROVED)
                .build());

        User secondaryDriverUser = createUser("dispatch.driver.secondary@test.com", Role.DRIVER);
        secondaryDriver = driverRepository.save(Driver.builder()
                .user(secondaryDriverUser)
                .vehicleId("KA01BB2222")
                .rating(4.6)
                .available(true)
                .onboardingStatus(DriverOnboardingStatus.APPROVED)
                .build());

        User suspendedDriverUser = createUser("dispatch.driver.suspended@test.com", Role.DRIVER);
        suspendedDriver = driverRepository.save(Driver.builder()
                .user(suspendedDriverUser)
                .vehicleId("KA01CC3333")
                .rating(4.1)
                .available(true)
                .onboardingStatus(DriverOnboardingStatus.SUSPENDED)
                .build());

        pendingRequest = rideRequestRepository.save(RideRequest.builder()
                .rider(rider)
                .paymentMethod(PaymentMethod.WALLET)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .fare(BigDecimal.valueOf(180))
                .requestedTime(LocalDateTime.now().minusMinutes(3))
                .build());

        rideOfferRepository.save(RideOffer.builder()
                .rideRequest(pendingRequest)
                .driver(primaryDriver)
                .status(RideOfferStatus.OFFERED)
                .expiresAt(LocalDateTime.now().plusSeconds(45))
                .build());
        rideOfferRepository.save(RideOffer.builder()
                .rideRequest(pendingRequest)
                .driver(secondaryDriver)
                .status(RideOfferStatus.OFFERED)
                .expiresAt(LocalDateTime.now().plusSeconds(45))
                .build());

        activeRide = rideRepository.save(Ride.builder()
                .rider(rider)
                .driver(primaryDriver)
                .paymentMethod(PaymentMethod.WALLET)
                .rideStatus(RideStatus.CONFIRMED)
                .fare(BigDecimal.valueOf(220))
                .otp("1234")
                .createdTime(LocalDateTime.now().minusMinutes(5))
                .build());
        primaryDriver.setAvailable(false);
        driverRepository.save(primaryDriver);
    }

    @Test
    @DisplayName("Admin dispatch endpoints expose queue, offers, audit, and ops health")
    void dispatchReadEndpoints_shouldReturnData() throws Exception {
        mockMvc.perform(withAdminAuth(get("/api/v1/admin/dispatch/requests")
                        .param("page", "0")
                        .param("size", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].rideRequestId").value(pendingRequest.getId()))
                .andExpect(jsonPath("$.data.content[0].offeredDriverCount").value(2));

        mockMvc.perform(withAdminAuth(get("/api/v1/admin/dispatch/active-rides")
                        .param("page", "0")
                        .param("size", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].rideId").value(activeRide.getId()));

        mockMvc.perform(withAdminAuth(get("/api/v1/admin/dispatch/requests/" + pendingRequest.getId() + "/offers")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].driverId").value(primaryDriver.getId()));

        mockMvc.perform(withAdminAuth(get("/api/v1/admin/ops-health")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDrivers").isNumber())
                .andExpect(jsonPath("$.data.pendingRideRequests").isNumber());
    }

    @Test
    @DisplayName("Assign pending request should create confirmed ride and append dispatch audit")
    void assignPendingRideRequest_shouldCreateRideAndAudit() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/dispatch/requests/" + pendingRequest.getId() + "/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "driverId", secondaryDriver.getId(),
                                "reason", "Manual assignment for SLA breach."
                        )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideStatus").value("CONFIRMED"));

        RideRequest savedRequest = rideRequestRepository.findById(pendingRequest.getId()).orElseThrow();
        assertThat(savedRequest.getRideRequestStatus()).isEqualTo(RideRequestStatus.CONFIRMED);

        List<AdminDispatchAudit> auditRows = adminDispatchAuditRepository.findAllByOrderByCreatedAtDesc(org.springframework.data.domain.PageRequest.of(0, 10)).getContent();
        assertThat(auditRows).isNotEmpty();
        assertThat(auditRows.getFirst().getActionType()).isEqualTo(AdminDispatchActionType.ASSIGN_REQUEST);
        assertThat(auditRows.getFirst().getReason()).isEqualTo("Manual assignment for SLA breach.");
    }

    @Test
    @DisplayName("Assign pending request should fail with 400 when reason is blank")
    void assignPendingRideRequest_withoutReason_shouldReturnBadRequest() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/dispatch/requests/" + pendingRequest.getId() + "/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "driverId", secondaryDriver.getId(),
                                "reason", ""
                        )))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Input validation failed"));
    }

    @Test
    @DisplayName("Assign pending request should reject suspended drivers with conflict")
    void assignPendingRideRequest_withSuspendedDriver_shouldReturnConflict() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/dispatch/requests/" + pendingRequest.getId() + "/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "driverId", suspendedDriver.getId(),
                                "reason", "Manual assignment trial."
                        )))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("Driver is not approved for dispatch assignments."));
    }

    @Test
    @DisplayName("Reassign and force-cancel actions should persist state changes and audit rows")
    void reassignAndCancelActions_shouldPersistAndAudit() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/dispatch/rides/" + activeRide.getId() + "/reassign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "driverId", secondaryDriver.getId(),
                                "reason", "Reassign for faster ETA."
                        )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.driver.id").value(secondaryDriver.getId()));

        mockMvc.perform(withAdminAuth(post("/api/v1/admin/dispatch/rides/" + activeRide.getId() + "/cancel")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Safety escalation.")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideStatus").value("CANCELLED"));

        mockMvc.perform(withAdminAuth(post("/api/v1/admin/dispatch/requests/" + pendingRequest.getId() + "/cancel")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Rider requested cancellation.")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideRequestStatus").value("CANCELLED"));

        List<AdminDispatchAudit> audits = adminDispatchAuditRepository
                .findAllByOrderByCreatedAtDesc(org.springframework.data.domain.PageRequest.of(0, 20))
                .getContent();
        assertThat(audits).extracting(AdminDispatchAudit::getActionType).contains(
                AdminDispatchActionType.REASSIGN_RIDE,
                AdminDispatchActionType.FORCE_CANCEL_RIDE,
                AdminDispatchActionType.FORCE_CANCEL_REQUEST
        );
    }

    @Test
    @DisplayName("Driver acceptance race should allow one winner and return conflict for the second driver")
    void driverAcceptanceRace_shouldAllowSingleWinner() throws Exception {
        mockMvc.perform(withDriverAuth(post("/drivers/acceptRide/" + pendingRequest.getId()), primaryDriver))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideStatus").value("CONFIRMED"));

        mockMvc.perform(withDriverAuth(post("/drivers/acceptRide/" + pendingRequest.getId()), secondaryDriver))
                .andExpect(status().isConflict());

        List<RideOffer> offers = rideOfferRepository.findByRideRequestIdOrderByOfferedAtDesc(pendingRequest.getId());
        assertThat(offers).hasSize(2);
        assertThat(offers).extracting(RideOffer::getStatus).contains(RideOfferStatus.ACCEPTED, RideOfferStatus.REVOKED);
    }

    private MockHttpServletRequestBuilder withAdminAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", adminUser.getId())
                .header("X-Test-Email", adminUser.getEmail())
                .header("X-Test-Role", "ROLE_ADMIN");
    }

    private MockHttpServletRequestBuilder withDriverAuth(MockHttpServletRequestBuilder builder, Driver driver) {
        return builder
                .header("X-Test-User-Id", driver.getUser().getId())
                .header("X-Test-Email", driver.getUser().getEmail())
                .header("X-Test-Role", "ROLE_DRIVER");
    }

    private User createUser(String email, Role role) {
        String uniqueEmail = uniqueEmail(email);
        return userRepository.save(User.builder()
                .email(uniqueEmail)
                .password("password123")
                .firstName("Test")
                .lastName(role.name())
                .roles(Set.of(role))
                .active(true)
                .build());
    }

    private String uniqueEmail(String baseEmail) {
        long suffix = EMAIL_SEQUENCE.incrementAndGet();
        int atIndex = baseEmail.indexOf('@');
        return baseEmail.substring(0, atIndex) + "+" + suffix + baseEmail.substring(atIndex);
    }
}
