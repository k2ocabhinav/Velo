package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Rating;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.WalletTransaction;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.entities.enums.TransactionType;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RatingRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.repositories.WalletRepository;
import com.velo.platform.repositories.WalletTransactionRepository;
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
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class RiderControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private RideRequestRepository rideRequestRepository;
    @Autowired private RatingRepository ratingRepository;
    @Autowired private WalletRepository walletRepository;
    @Autowired private WalletTransactionRepository walletTransactionRepository;

    private Rider testRider;
    private Driver testDriver;
    private Ride confirmedRide;
    private Ride endedRide;

    @BeforeEach
    void setUp() {
        walletTransactionRepository.deleteAll();
        walletRepository.deleteAll();
        rideRequestRepository.deleteAll();
        ratingRepository.deleteAll();
        rideRepository.deleteAll();
        driverRepository.deleteAll();
        riderRepository.deleteAll();
        userRepository.deleteAll();

        User riderUser = new User();
        riderUser.setEmail("rider@test.com");
        riderUser.setPassword("password123");
        riderUser.setFirstName("Test");
        riderUser.setLastName("Rider");
        riderUser.setRoles(Set.of(Role.RIDER));
        riderUser.setActive(true);
        riderUser = userRepository.save(riderUser);

        testRider = new Rider();
        testRider.setUser(riderUser);
        testRider.setRating(5.0);
        testRider = riderRepository.save(testRider);

        User driverUser = new User();
        driverUser.setEmail("driver@test.com");
        driverUser.setPassword("password123");
        driverUser.setFirstName("Test");
        driverUser.setLastName("Driver");
        driverUser.setRoles(Set.of(Role.DRIVER));
        driverUser.setActive(true);
        driverUser = userRepository.save(driverUser);

        testDriver = new Driver();
        testDriver.setUser(driverUser);
        testDriver.setAvailable(true);
        testDriver.setRating(4.9);
        testDriver.setVehicleId("KA02CD5678");
        testDriver = driverRepository.save(testDriver);

        confirmedRide = Ride.builder()
                .rider(testRider)
                .driver(testDriver)
                .rideStatus(com.velo.platform.entities.enums.RideStatus.CONFIRMED)
                .paymentMethod(PaymentMethod.WALLET)
                .fare(BigDecimal.valueOf(90.0))
                .otp("1234")
                .build();
        confirmedRide = rideRepository.save(confirmedRide);

        endedRide = Ride.builder()
                .rider(testRider)
                .driver(testDriver)
                .rideStatus(com.velo.platform.entities.enums.RideStatus.ENDED)
                .paymentMethod(PaymentMethod.WALLET)
                .fare(BigDecimal.valueOf(140.0))
                .otp("5678")
                .startedAt(LocalDateTime.now().minusMinutes(30))
                .endedAt(LocalDateTime.now().minusMinutes(10))
                .build();
        endedRide = rideRepository.save(endedRide);

        ratingRepository.save(Rating.builder()
                .ride(endedRide)
                .driver(testDriver)
                .rider(testRider)
                .build());

    }

    private MockHttpServletRequestBuilder withRiderAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", testRider.getUser().getId())
                .header("X-Test-Email", testRider.getUser().getEmail())
                .header("X-Test-Role", "ROLE_" + Role.RIDER.name());
    }

    @Test
    @DisplayName("GET /riders/getMyProfile should return rider profile")
    void getMyProfile_ShouldReturnProfile() throws Exception {
        mockMvc.perform(withRiderAuth(get("/riders/getMyProfile")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value("rider@test.com"));
    }

    @Test
    @DisplayName("GET /riders/getMyRides should return paginated rides")
    void getMyRides_ShouldReturnRides() throws Exception {
        mockMvc.perform(withRiderAuth(get("/riders/getMyRides")
                        .param("pageOffset", "0")
                        .param("pageSize", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("POST /riders/rateDriver/{rideId}/{rating} should rate driver")
    void rateDriver_ShouldReturnOk() throws Exception {
        mockMvc.perform(withRiderAuth(post("/riders/rateDriver/" + endedRide.getId() + "/5")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value("driver@test.com"));
    }

    @Test
    @DisplayName("POST /riders/rateDriver rejects ratings above five")
    void rateDriver_ShouldRejectOutOfRangeRating() throws Exception {
        mockMvc.perform(withRiderAuth(post("/riders/rateDriver")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rideId\":" + endedRide.getId() + ",\"rating\":6}")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Legacy rate-driver path also rejects ratings above five")
    void rateDriverPath_ShouldRejectOutOfRangeRating() throws Exception {
        mockMvc.perform(withRiderAuth(post("/riders/rateDriver/" + endedRide.getId() + "/6")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /riders/cancelRide/{rideId} should cancel ride")
    void cancelRide_ShouldReturnOk() throws Exception {
        mockMvc.perform(withRiderAuth(post("/riders/cancelRide/" + confirmedRide.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideStatus").value("CANCELLED"));
    }

    @Test
    @DisplayName("GET /riders/active-ride should return tracking payload for active ride")
    void getActiveRide_ShouldReturnTrackingPayload() throws Exception {
        mockMvc.perform(withRiderAuth(get("/riders/active-ride")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideId").value(confirmedRide.getId()))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.canCancel").value(true));
    }

    @Test
    @DisplayName("GET /riders/current-request should restore the rider's pending request")
    void getCurrentRideRequest_ShouldReturnPendingRequest() throws Exception {
        RideRequest pendingRequest = rideRequestRepository.save(RideRequest.builder()
                .tenantId(testRider.getTenantId())
                .rider(testRider)
                .paymentMethod(PaymentMethod.WALLET)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .build());

        mockMvc.perform(withRiderAuth(get("/riders/current-request")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(pendingRequest.getId()))
                .andExpect(jsonPath("$.data.rideRequestStatus").value("PENDING"));
    }

    @Test
    @DisplayName("GET /riders/wallet returns the current tenant's balance and paginated transactions")
    void getMyWallet_ShouldReturnBalanceAndTenantScopedTransactions() throws Exception {
        Wallet wallet = walletRepository.saveAndFlush(Wallet.builder()
                .user(testRider.getUser())
                .tenantId(1L)
                .balance(new BigDecimal("125.50"))
                .build());
        walletTransactionRepository.saveAndFlush(WalletTransaction.builder()
                .tenantId(1L)
                .wallet(wallet)
                .ride(endedRide)
                .transactionType(TransactionType.DEBIT)
                .transactionMethod(TransactionMethod.RIDE)
                .amount(new BigDecimal("18.00"))
                .build());
        walletTransactionRepository.saveAndFlush(WalletTransaction.builder()
                .tenantId(1L)
                .wallet(wallet)
                .transactionType(TransactionType.CREDIT)
                .transactionMethod(TransactionMethod.BANKING)
                .amount(new BigDecimal("20.00"))
                .build());

        User otherTenantUser = userRepository.save(User.builder()
                .email("other-tenant-rider@test.com")
                .password("password123")
                .tenantId(2L)
                .roles(Set.of(Role.RIDER))
                .active(true)
                .build());
        Wallet otherTenantWallet = walletRepository.saveAndFlush(Wallet.builder()
                .user(otherTenantUser)
                .tenantId(2L)
                .balance(new BigDecimal("999.00"))
                .build());
        walletTransactionRepository.saveAndFlush(WalletTransaction.builder()
                .tenantId(2L)
                .wallet(otherTenantWallet)
                .transactionType(TransactionType.CREDIT)
                .transactionMethod(TransactionMethod.BANKING)
                .amount(new BigDecimal("999.00"))
                .build());

        mockMvc.perform(withRiderAuth(get("/riders/wallet")
                        .param("page", "0")
                        .param("size", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.balance").value(125.50))
                .andExpect(jsonPath("$.data.currency").value("USD"))
                .andExpect(jsonPath("$.data.transactions.content", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.data.transactions.totalElements").value(2))
                .andExpect(jsonPath("$.data.transactions.content[0].type").value("CREDIT"))
                .andExpect(jsonPath("$.data.transactions.content[0].method").value("BANKING"))
                .andExpect(jsonPath("$.data.transactions.content[0].amount").value(20.00))
                .andExpect(jsonPath("$.data.transactions.content[0].timestamp").isNotEmpty());

        mockMvc.perform(withRiderAuth(get("/riders/wallet")
                        .param("page", "1")
                        .param("size", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.balance").value(125.50))
                .andExpect(jsonPath("$.data.transactions.content[0].type").value("DEBIT"))
                .andExpect(jsonPath("$.data.transactions.content[0].rideReference").value(endedRide.getId()));
    }
}
