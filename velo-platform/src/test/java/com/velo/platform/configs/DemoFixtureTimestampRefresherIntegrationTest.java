package com.velo.platform.configs;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.repositories.WalletRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DemoFixtureTimestampRefresherIntegrationTest {

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManager entityManager;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private WalletRepository walletRepository;
    @Autowired private RideRequestRepository rideRequestRepository;
    @Autowired private RideRepository rideRepository;

    @Test
    void run_onlyResetsNamedDemoFixturesAndLeavesUnrelatedLocalRowsUntouched() {
        Tenant velo = tenantRepository.save(Tenant.builder().slug("default").name("Velo").active(true).build());
        Tenant saffron = tenantRepository.save(Tenant.builder().slug("saffron-routes").name("Saffron").active(true).build());

        User aliceUser = saveUser("alice@example.com", "Alice", "Rider", velo.getId());
        User bobUser = saveUser("bob.driver@example.com", "Bob", "Driver", velo.getId());
        User carolUser = saveUser("carol.driver@example.com", "Carol", "Driver", velo.getId());
        User daveUser = saveUser("dave@example.com", "Dave", "Rider", velo.getId());
        User henryUser = saveUser("henry@example.com", "Henry", "Rider", velo.getId());
        User ordinaryUser = saveUser("ordinary.local@example.com", "Local", "Rider", velo.getId());
        User guestUser = saveUser("guest@saffronroutes.demo", "Ananya", "Rider", saffron.getId());
        User guest2User = saveUser("guest2@saffronroutes.demo", "Rohan", "Rider", saffron.getId());
        User chauffeur1User = saveUser("chauffeur1@saffronroutes.demo", "Karan", "Driver", saffron.getId());
        User chauffeur2User = saveUser("chauffeur2@saffronroutes.demo", "Mehul", "Driver", saffron.getId());

        Rider alice = saveRider(aliceUser, velo.getId());
        Rider dave = saveRider(daveUser, velo.getId());
        Rider henry = saveRider(henryUser, velo.getId());
        Rider ordinary = saveRider(ordinaryUser, velo.getId());
        Rider guest = saveRider(guestUser, saffron.getId());
        Rider guest2 = saveRider(guest2User, saffron.getId());
        Driver bob = saveDriver(bobUser, velo.getId(), true);
        Driver carol = saveDriver(carolUser, velo.getId(), false);
        Driver chauffeur1 = saveDriver(chauffeur1User, saffron.getId(), true);
        saveDriver(chauffeur2User, saffron.getId(), false);

        walletRepository.save(Wallet.builder().user(henryUser).tenantId(velo.getId()).balance(BigDecimal.ZERO).build());
        walletRepository.save(Wallet.builder().user(guestUser).tenantId(saffron.getId()).balance(BigDecimal.ZERO).build());
        walletRepository.save(Wallet.builder().user(guest2User).tenantId(saffron.getId()).balance(BigDecimal.ZERO).build());

        RideRequest veloFixtureRequest = saveRequest(
                dave, velo.getId(), RideRequestStatus.CONFIRMED, "DEMO-VELO-PENDING-01", null);
        saveRequest(guest2, saffron.getId(), RideRequestStatus.CONFIRMED, "DEMO-SAFFRON-PENDING-01", null);
        RideRequest henrySessionRequest = saveRequest(henry, velo.getId(), RideRequestStatus.PENDING, null, null);
        LocalDateTime unrelatedScheduledAt = LocalDateTime.of(2026, 11, 3, 14, 30);
        RideRequest unrelatedScheduledRequest = saveRequest(
                ordinary, velo.getId(), RideRequestStatus.SCHEDULED, null, unrelatedScheduledAt);

        Ride namedFixtureRide = rideRepository.saveAndFlush(Ride.builder()
                .tenantId(velo.getId())
                .rider(alice)
                .driver(carol)
                .externalReference("DEMO-VELO-ONGOING-01")
                .otp("2468")
                .rideStatus(RideStatus.ENDED)
                .fare(new BigDecimal("150.00"))
                .build());
        Ride unrelatedRideWithReusableOtp = rideRepository.saveAndFlush(Ride.builder()
                .tenantId(velo.getId())
                .rider(ordinary)
                .driver(bob)
                .otp("2468")
                .rideStatus(RideStatus.CANCELLED)
                .fare(new BigDecimal("99.00"))
                .build());

        new DemoFixtureTimestampRefresher(jdbcTemplate).run(null);
        entityManager.clear();

        RideRequest savedFixtureRequest = rideRequestRepository.findById(veloFixtureRequest.getId()).orElseThrow();
        RideRequest savedSessionRequest = rideRequestRepository.findById(henrySessionRequest.getId()).orElse(null);
        RideRequest savedUnrelatedRequest = rideRequestRepository.findById(unrelatedScheduledRequest.getId()).orElseThrow();
        Ride savedFixtureRide = rideRepository.findById(namedFixtureRide.getId()).orElseThrow();
        Ride savedUnrelatedRide = rideRepository.findById(unrelatedRideWithReusableOtp.getId()).orElseThrow();

        assertThat(savedFixtureRequest.getRideRequestStatus()).isEqualTo(RideRequestStatus.PENDING);
        assertThat(savedSessionRequest).isNull();
        assertThat(savedUnrelatedRequest.getRideRequestStatus()).isEqualTo(RideRequestStatus.SCHEDULED);
        assertThat(savedUnrelatedRequest.getScheduledTime()).isEqualTo(unrelatedScheduledAt);
        assertThat(savedFixtureRide.getRideStatus()).isEqualTo(RideStatus.ONGOING);
        assertThat(savedUnrelatedRide.getRideStatus()).isEqualTo(RideStatus.CANCELLED);
        assertThat(savedUnrelatedRide.getFare()).isEqualByComparingTo("99.00");
    }

    private User saveUser(String email, String firstName, String lastName, Long tenantId) {
        return userRepository.save(User.builder()
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .password("encoded")
                .phoneNumber("+1-555-0100")
                .tenantId(tenantId)
                .active(true)
                .roles(Set.of(Role.RIDER, Role.DRIVER))
                .build());
    }

    private Rider saveRider(User user, Long tenantId) {
        return riderRepository.save(Rider.builder().user(user).tenantId(tenantId).rating(4.5).build());
    }

    private Driver saveDriver(User user, Long tenantId, boolean available) {
        return driverRepository.save(Driver.builder()
                .user(user)
                .tenantId(tenantId)
                .available(available)
                .vehicleId("TEST-" + user.getId())
                .build());
    }

    private RideRequest saveRequest(Rider rider, Long tenantId, RideRequestStatus status,
                                   String externalReference, LocalDateTime scheduledTime) {
        return rideRequestRepository.saveAndFlush(RideRequest.builder()
                .rider(rider)
                .tenantId(tenantId)
                .paymentMethod(PaymentMethod.CASH)
                .rideRequestStatus(status)
                .externalReference(externalReference)
                .scheduledTime(scheduledTime)
                .fare(new BigDecimal("100.00"))
                .build());
    }
}
