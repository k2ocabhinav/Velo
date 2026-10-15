package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Rating;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RatingRepository;
import com.velo.platform.repositories.RideRepository;
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
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class DriverControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private DriverRepository driverRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private RatingRepository ratingRepository;

    private Driver testDriver;
    private Rider testRider;
    private Ride confirmedRide;
    private Ride endedRide;

    @BeforeEach
    void setUp() {
        ratingRepository.deleteAll();
        rideRepository.deleteAll();
        driverRepository.deleteAll();
        riderRepository.deleteAll();
        userRepository.deleteAll();

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
        testDriver.setRating(5.0);
        testDriver.setVehicleId("KA01AB1234");
        testDriver = driverRepository.save(testDriver);

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
        testRider.setRating(4.8);
        testRider = riderRepository.save(testRider);

        confirmedRide = Ride.builder()
                .rider(testRider)
                .driver(testDriver)
                .rideStatus(com.velo.platform.entities.enums.RideStatus.CONFIRMED)
                .paymentMethod(PaymentMethod.WALLET)
                .fare(BigDecimal.valueOf(120.0))
                .otp("1234")
                .build();
        confirmedRide = rideRepository.save(confirmedRide);

        endedRide = Ride.builder()
                .rider(testRider)
                .driver(testDriver)
                .rideStatus(com.velo.platform.entities.enums.RideStatus.ENDED)
                .paymentMethod(PaymentMethod.CASH)
                .fare(BigDecimal.valueOf(220.0))
                .otp("5678")
                .startedAt(LocalDateTime.now().minusMinutes(25))
                .endedAt(LocalDateTime.now().minusMinutes(5))
                .build();
        endedRide = rideRepository.save(endedRide);

        ratingRepository.save(Rating.builder()
                .ride(endedRide)
                .driver(testDriver)
                .rider(testRider)
                .build());

    }

    private MockHttpServletRequestBuilder withDriverAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", testDriver.getUser().getId())
                .header("X-Test-Email", testDriver.getUser().getEmail())
                .header("X-Test-Role", "ROLE_" + Role.DRIVER.name());
    }

    @Test
    @DisplayName("GET /drivers/getMyProfile should return driver profile")
    void getMyProfile_ShouldReturnProfile() throws Exception {
        mockMvc.perform(withDriverAuth(get("/drivers/getMyProfile")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value("driver@test.com"))
                .andExpect(jsonPath("$.data.user.name").value("Test Driver"));
    }

    @Test
    @DisplayName("GET /drivers/getMyRides should return paginated rides")
    void getMyRides_ShouldReturnRides() throws Exception {
        mockMvc.perform(withDriverAuth(get("/drivers/getMyRides")
                        .param("pageOffset", "0")
                        .param("pageSize", "10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("POST /drivers/rateRider/{rideId}/{rating} should rate rider")
    void rateRider_ShouldReturnOk() throws Exception {
        mockMvc.perform(withDriverAuth(post("/drivers/rateRider/" + endedRide.getId() + "/5")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value("rider@test.com"));
    }

    @Test
    @DisplayName("POST /drivers/cancelRide/{rideId} should cancel ride")
    void cancelRide_ShouldReturnOk() throws Exception {
        mockMvc.perform(withDriverAuth(post("/drivers/cancelRide/" + confirmedRide.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rideStatus").value("CANCELLED"));
    }

    @Test
    @DisplayName("POST /drivers/startRide/{rideId} uses the accepted ride ID path contract")
    void startRide_usesRideIdPathVariable() throws Exception {
        mockMvc.perform(withDriverAuth(post("/drivers/startRide/" + confirmedRide.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "otp": "1234"
                                }
                                """)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(confirmedRide.getId()))
                .andExpect(jsonPath("$.data.rideStatus").value("ONGOING"));
    }

    @Test
    @DisplayName("PUT /drivers/availability should return current profile for no-op transitions")
    void toggleAvailability_WithNoStateChange_ShouldReturnOk() throws Exception {
        mockMvc.perform(withDriverAuth(put("/drivers/availability")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "available": true
                                }
                                """)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(true));
    }

    @Test
    @DisplayName("PUT /drivers/availability should return conflict when active rides exist")
    void toggleAvailability_WithActiveRides_ShouldReturnConflict() throws Exception {
        mockMvc.perform(withDriverAuth(put("/drivers/availability")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "available": false
                                }
                                """)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("Cannot go offline with active rides. Please complete or cancel active rides first."));
    }

    @Test
    @DisplayName("PUT /drivers/location should persist and return location payload")
    void updateDriverLocation_ShouldReturnLocationPayload() throws Exception {
        mockMvc.perform(withDriverAuth(put("/drivers/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "lat": 12.9716,
                                  "lng": 77.5946,
                                  "heading": 45,
                                  "speedKph": 22.5,
                                  "accuracyM": 8
                                }
                                """)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lat").value(12.9716))
                .andExpect(jsonPath("$.data.lng").value(77.5946))
                .andExpect(jsonPath("$.data.heading").value(45.0));
    }
}
