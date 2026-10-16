package com.velo.platform.controllers;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.DriverEarning;
import com.velo.platform.entities.PayoutRequest;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.PayoutStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.repositories.DriverEarningRepository;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.PayoutRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.repositories.WalletRepository;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class DriverEarningsControllerIntegrationTest {

    private static final AtomicLong EMAIL_SEQUENCE = new AtomicLong();

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private DriverEarningRepository driverEarningRepository;
    @Autowired private PayoutRequestRepository payoutRequestRepository;
    @Autowired private WalletRepository walletRepository;

    private User adminUser;
    private Driver testDriver;
    private Driver otherDriver;
    private Rider testRider;

    @BeforeEach
    void setUp() {
        adminUser = createUser("admin@test.com", Role.ADMIN);

        User driverUser = createUser("driver@test.com", Role.DRIVER);
        testDriver = driverRepository.save(Driver.builder()
                .user(driverUser)
                .available(true)
                .rating(4.9)
                .vehicleId("KA01AB1234")
                .build());
        walletRepository.save(Wallet.builder()
                .user(driverUser)
                .balance(BigDecimal.ZERO)
                .build());

        User otherDriverUser = createUser("other-driver@test.com", Role.DRIVER);
        otherDriver = driverRepository.save(Driver.builder()
                .user(otherDriverUser)
                .available(true)
                .rating(4.7)
                .vehicleId("KA01AB5678")
                .build());
        walletRepository.save(Wallet.builder()
                .user(otherDriverUser)
                .balance(BigDecimal.ZERO)
                .build());

        User riderUser = createUser("rider@test.com", Role.RIDER);
        testRider = riderRepository.save(Rider.builder()
                .user(riderUser)
                .rating(4.8)
                .build());
    }

    @Test
    @DisplayName("GET /drivers/earnings returns only the signed-in driver's earnings history")
    void getEarningsHistory_ShouldReturnCurrentDriverEntries() throws Exception {
        DriverEarning olderEarning = createEarning(
                testDriver,
                new BigDecimal("120.00"),
                new BigDecimal("24.00"),
                UtcTimes.now().minusDays(1));
        DriverEarning newerEarning = createEarning(
                testDriver,
                new BigDecimal("80.00"),
                new BigDecimal("16.00"),
                UtcTimes.now().minusHours(2));
        createEarning(otherDriver, new BigDecimal("95.00"), new BigDecimal("19.00"), UtcTimes.now().minusHours(1));

        mockMvc.perform(withDriverAuth(get("/drivers/earnings")
                        .param("pageOffset", "0")
                        .param("pageSize", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(2)))
                .andExpect(jsonPath("$.data.content[0].rideId").value(newerEarning.getRide().getId()))
                .andExpect(jsonPath("$.data.content[0].netEarning").value(64.00))
                .andExpect(jsonPath("$.data.content[1].rideId").value(olderEarning.getRide().getId()))
                .andExpect(jsonPath("$.data.content[1].netEarning").value(96.00));
    }

    @Test
    @DisplayName("GET /drivers/earnings/summary returns the requested weekly aggregate")
    void getEarningsSummary_ShouldReturnWeeklySummary() throws Exception {
        LocalDate today = UtcTimes.today();
        createEarning(testDriver, new BigDecimal("100.00"), new BigDecimal("20.00"), today.atStartOfDay().plusHours(9));
        createEarning(testDriver, new BigDecimal("70.00"), new BigDecimal("14.00"), today.atStartOfDay().plusHours(12));
        createEarning(otherDriver, new BigDecimal("60.00"), new BigDecimal("12.00"), today.atStartOfDay().plusHours(10));

        mockMvc.perform(withDriverAuth(get("/drivers/earnings/summary")
                        .param("period", "WEEKLY")
                        .param("date", today.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.period").value("WEEKLY"))
                .andExpect(jsonPath("$.data.rideCount").value(2))
                .andExpect(jsonPath("$.data.totalGross").value(170.00))
                .andExpect(jsonPath("$.data.totalCommission").value(34.00))
                .andExpect(jsonPath("$.data.totalNet").value(136.00));
    }

    @Test
    @DisplayName("GET /drivers/earnings/balance subtracts pending, approved, and processed payouts")
    void getAvailableBalance_ShouldSubtractReservedPayouts() throws Exception {
        createEarning(testDriver, new BigDecimal("100.00"), new BigDecimal("20.00"), UtcTimes.now().minusDays(2));
        createEarning(testDriver, new BigDecimal("80.00"), new BigDecimal("16.00"), UtcTimes.now().minusDays(1));
        createPayout(testDriver, new BigDecimal("20.00"), PayoutStatus.PENDING, UtcTimes.now().minusHours(5), null);
        createPayout(testDriver, new BigDecimal("15.00"), PayoutStatus.APPROVED, UtcTimes.now().minusHours(4), "approved");
        createPayout(testDriver, new BigDecimal("10.00"), PayoutStatus.PROCESSED, UtcTimes.now().minusHours(3), "processed");

        mockMvc.perform(withDriverAuth(get("/drivers/earnings/balance")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(99.00));
    }

    @Test
    @DisplayName("POST /drivers/earnings/payout creates a pending payout request")
    void requestPayout_ShouldCreatePendingRequest() throws Exception {
        createEarning(testDriver, new BigDecimal("100.00"), new BigDecimal("20.00"), UtcTimes.now().minusDays(1));

        mockMvc.perform(withDriverAuth(post("/drivers/earnings/payout")
                        .param("amount", "50.00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amount").value(50.00))
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        mockMvc.perform(withDriverAuth(get("/drivers/earnings/payouts")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].amount").value(50.00))
                .andExpect(jsonPath("$.data.content[0].status").value("PENDING"));
    }

    @Test
    @DisplayName("POST /drivers/earnings/payout rejects a non-numeric amount with a 400")
    void requestPayout_WithNonNumericAmount_ShouldReturnBadRequest() throws Exception {
        mockMvc.perform(withDriverAuth(post("/drivers/earnings/payout")
                        .param("amount", "abc")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /drivers/earnings/payout rejects a missing amount with a 400")
    void requestPayout_WithoutAmount_ShouldReturnBadRequest() throws Exception {
        mockMvc.perform(withDriverAuth(post("/drivers/earnings/payout")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /drivers/earnings/payouts returns only the signed-in driver's payouts")
    void getMyPayouts_ShouldReturnCurrentDriverPayoutHistory() throws Exception {
        PayoutRequest olderRequest = createPayout(
                testDriver, new BigDecimal("40.00"), PayoutStatus.PROCESSED, UtcTimes.now().minusDays(2), "older");
        PayoutRequest newerRequest = createPayout(
                testDriver, new BigDecimal("25.00"), PayoutStatus.PENDING, UtcTimes.now().minusHours(6), null);
        createPayout(otherDriver, new BigDecimal("99.00"), PayoutStatus.PENDING, UtcTimes.now().minusHours(2), null);

        mockMvc.perform(withDriverAuth(get("/drivers/earnings/payouts")
                        .param("pageOffset", "0")
                        .param("pageSize", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(2)))
                .andExpect(jsonPath("$.data.content[0].id").value(newerRequest.getId()))
                .andExpect(jsonPath("$.data.content[1].id").value(olderRequest.getId()));
    }

    @Test
    @DisplayName("GET /api/v1/admin/payouts/pending returns only pending payouts")
    void getPendingPayouts_ShouldReturnPendingRequestsForAdmin() throws Exception {
        PayoutRequest pendingRequest = createPayout(
                testDriver, new BigDecimal("35.00"), PayoutStatus.PENDING, UtcTimes.now().minusHours(3), null);
        createPayout(testDriver, new BigDecimal("15.00"), PayoutStatus.APPROVED, UtcTimes.now().minusHours(2), "approved");

        mockMvc.perform(withAdminAuth(get("/api/v1/admin/payouts/pending")
                        .param("page", "0")
                        .param("size", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id").value(pendingRequest.getId()))
                .andExpect(jsonPath("$.data.content[0].status").value("PENDING"));
    }

    @Test
    @DisplayName("GET /api/v1/admin/payouts rejects page and size outside the paging bounds")
    void getPayouts_WithInvalidPaging_ShouldReturn400() throws Exception {
        mockMvc.perform(withAdminAuth(get("/api/v1/admin/payouts").param("page", "-1")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(withAdminAuth(get("/api/v1/admin/payouts").param("size", "0")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(withAdminAuth(get("/api/v1/admin/payouts").param("size", "201")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/v1/admin/payouts/{id}/approve marks a payout as approved")
    void approvePayout_ShouldUpdateStatusAndAdminNote() throws Exception {
        PayoutRequest pendingRequest = createPayout(
                testDriver, new BigDecimal("55.00"), PayoutStatus.PENDING, UtcTimes.now().minusHours(1), null);

        mockMvc.perform(withAdminAuth(post("/api/v1/admin/payouts/" + pendingRequest.getId() + "/approve")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Reviewed and approved")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(pendingRequest.getId()))
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.adminNote").value("Reviewed and approved"));
    }

    @Test
    @DisplayName("POST /api/v1/admin/payouts/{id}/reject marks a payout as rejected")
    void rejectPayout_ShouldUpdateStatusAndAdminNote() throws Exception {
        PayoutRequest pendingRequest = createPayout(
                testDriver, new BigDecimal("30.00"), PayoutStatus.PENDING, UtcTimes.now().minusHours(1), null);

        mockMvc.perform(withAdminAuth(post("/api/v1/admin/payouts/" + pendingRequest.getId() + "/reject")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Bank details mismatch")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(pendingRequest.getId()))
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adminNote").value("Bank details mismatch"));
    }

    @Test
    @DisplayName("POST /api/v1/admin/payouts/{id}/process marks a payout processed and credits the wallet")
    void processPayout_ShouldUpdateStatusAndCreditWallet() throws Exception {
        PayoutRequest approvedRequest = createPayout(
                testDriver, new BigDecimal("45.00"), PayoutStatus.APPROVED, UtcTimes.now().minusHours(1), "approved");

        mockMvc.perform(withAdminAuth(post("/api/v1/admin/payouts/" + approvedRequest.getId() + "/process")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(approvedRequest.getId()))
                .andExpect(jsonPath("$.data.status").value("PROCESSED"))
                .andExpect(jsonPath("$.data.processedAt").isNotEmpty());

        Wallet wallet = walletRepository.findByUser(testDriver.getUser()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(wallet.getBalance()).isEqualByComparingTo("45.00");
    }

    private MockHttpServletRequestBuilder withDriverAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", testDriver.getUser().getId())
                .header("X-Test-Email", testDriver.getUser().getEmail())
                .header("X-Test-Role", "ROLE_DRIVER");
    }

    private MockHttpServletRequestBuilder withAdminAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", adminUser.getId())
                .header("X-Test-Email", adminUser.getEmail())
                .header("X-Test-Role", "ROLE_ADMIN");
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

    private DriverEarning createEarning(Driver driver, BigDecimal grossFare, BigDecimal commission, LocalDateTime createdTime) {
        Ride ride = rideRepository.save(Ride.builder()
                .driver(driver)
                .rider(testRider)
                .rideStatus(RideStatus.ENDED)
                .paymentMethod(PaymentMethod.WALLET)
                .fare(grossFare)
                .otp("1234")
                .startedAt(createdTime.minusMinutes(20))
                .endedAt(createdTime.minusMinutes(5))
                .build());

        DriverEarning earning = driverEarningRepository.saveAndFlush(DriverEarning.builder()
                .driver(driver)
                .ride(ride)
                .grossFare(grossFare)
                .platformCommission(commission)
                .netEarning(grossFare.subtract(commission))
                .build());
        earning.setCreatedTime(createdTime);
        return driverEarningRepository.saveAndFlush(earning);
    }

    private PayoutRequest createPayout(Driver driver, BigDecimal amount, PayoutStatus status, LocalDateTime requestedAt, String adminNote) {
        PayoutRequest payoutRequest = payoutRequestRepository.saveAndFlush(PayoutRequest.builder()
                .driver(driver)
                .amount(amount)
                .status(status)
                .adminNote(adminNote)
                .build());
        payoutRequest.setRequestedAt(requestedAt);
        if (status == PayoutStatus.PROCESSED) {
            payoutRequest.setProcessedAt(requestedAt.plusHours(1));
        }
        return payoutRequestRepository.saveAndFlush(payoutRequest);
    }
}
