package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.DriverEarning;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.repositories.DriverEarningRepository;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.PayoutRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class PayoutConcurrencyIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private DriverEarningRepository driverEarningRepository;
    @Autowired private PayoutRequestRepository payoutRequestRepository;

    private Driver driver;

    @BeforeEach
    void setUp() {
        User driverUser = userRepository.save(User.builder()
                .email("payout-race-driver@test.com")
                .password("password123")
                .firstName("Race")
                .lastName("Driver")
                .roles(Set.of(Role.DRIVER))
                .active(true)
                .build());
        driver = driverRepository.save(Driver.builder()
                .user(driverUser)
                .available(true)
                .rating(4.8)
                .build());
    }

    @AfterEach
    void tearDown() {
        payoutRequestRepository.deleteAll();
        driverEarningRepository.deleteAll();
        rideRepository.deleteAll();
        riderRepository.deleteAll();
        driverRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Two concurrent payout requests cannot overdraw the same earnings")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentPayoutRequests_shouldNotOverdraw() throws Exception {
        seedEarning(new BigDecimal("100.00"));

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executor.submit(() -> submitPayout(ready, start));
            Future<Integer> second = executor.submit(() -> submitPayout(ready, start));

            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(java.util.List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        } finally {
            executor.shutdownNow();
        }

        assertThat(payoutRequestRepository.findAll()).hasSize(1);
    }

    private int submitPayout(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting to start payout request");
        }
        return mockMvc.perform(post("/drivers/earnings/payout")
                        .param("amount", "80.00")
                        .header("X-Test-User-Id", driver.getUser().getId())
                        .header("X-Test-Email", driver.getUser().getEmail())
                        .header("X-Test-Role", "ROLE_DRIVER"))
                .andReturn().getResponse().getStatus();
    }

    private void seedEarning(BigDecimal netEarning) {
        User riderUser = userRepository.save(User.builder()
                .email("payout-race-rider@test.com")
                .password("password123")
                .roles(Set.of(Role.RIDER))
                .active(true)
                .build());
        Rider rider = riderRepository.save(Rider.builder().user(riderUser).rating(4.8).build());

        Ride ride = rideRepository.save(Ride.builder()
                .driver(driver)
                .rider(rider)
                .rideStatus(RideStatus.ENDED)
                .paymentMethod(PaymentMethod.WALLET)
                .fare(netEarning)
                .otp("1234")
                .startedAt(LocalDateTime.now().minusMinutes(20))
                .endedAt(LocalDateTime.now().minusMinutes(5))
                .build());

        driverEarningRepository.saveAndFlush(DriverEarning.builder()
                .driver(driver)
                .ride(ride)
                .grossFare(netEarning)
                .platformCommission(BigDecimal.ZERO)
                .netEarning(netEarning)
                .build());
    }
}
