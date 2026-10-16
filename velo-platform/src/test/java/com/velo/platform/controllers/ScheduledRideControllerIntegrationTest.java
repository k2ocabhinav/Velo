package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.Role;
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

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class ScheduledRideControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private RideRequestRepository rideRequestRepository;

    private Rider testRider;
    private User riderUser;

    @BeforeEach
    void setUp() {
        rideRequestRepository.deleteAll();
        riderRepository.deleteAll();
        userRepository.deleteAll();

        riderUser = new User();
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
    }

    private MockHttpServletRequestBuilder withRiderAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", testRider.getUser().getId())
                .header("X-Test-Email", testRider.getUser().getEmail())
                .header("X-Test-Role", Role.RIDER.name());
    }

    @Test
    @DisplayName("POST /riders/schedule-ride should create scheduled ride")
    void scheduleRide_ShouldReturnOk() throws Exception {
        RideRequestDto requestDto = new RideRequestDto();
        requestDto.setScheduledTime(OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        requestDto.setPaymentMethod(PaymentMethod.WALLET);
        // Add coordinates for fare calculation
        requestDto.setPickupLocation(new com.velo.platform.dto.PointDto(new double[]{77.5946, 12.9716}));
        requestDto.setDropOffLocation(new com.velo.platform.dto.PointDto(new double[]{77.6101, 12.9307}));

        mockMvc.perform(withRiderAuth(post("/riders/schedule-ride"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SCHEDULED"));
    }

    @Test
    @DisplayName("GET /riders/scheduled-rides should return upcoming rides")
    void getMyScheduledRides_ShouldReturnRides() throws Exception {
        mockMvc.perform(withRiderAuth(get("/riders/scheduled-rides")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("PUT /riders/scheduled-rides/{id}/reschedule should update time")
    void rescheduleRide_ShouldReturnOk() throws Exception {
        // First create a ride
        com.velo.platform.entities.RideRequest rideRequest = com.velo.platform.entities.RideRequest.builder()
                .rider(testRider)
                .rideRequestStatus(RideRequestStatus.SCHEDULED)
                .scheduledTime(LocalDateTime.now(ZoneId.of("UTC")).plusHours(1))
                .pickupLocation(com.velo.platform.utils.GeometryUtil.createPoint(new com.velo.platform.dto.PointDto(new double[]{77.5946, 12.9716})))
                .dropOffLocation(com.velo.platform.utils.GeometryUtil.createPoint(new com.velo.platform.dto.PointDto(new double[]{77.6101, 12.9307})))
                .paymentMethod(PaymentMethod.WALLET)
                .fare(java.math.BigDecimal.valueOf(100.0))
                .build();
        rideRequest = rideRequestRepository.save(rideRequest);

        OffsetDateTime newTime = OffsetDateTime.now(ZoneOffset.UTC).plusHours(2);
        mockMvc.perform(withRiderAuth(put("/riders/scheduled-rides/" + rideRequest.getId() + "/reschedule")
                        .param("newTime", newTime.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SCHEDULED"));
    }

    @Test
    @DisplayName("DELETE /riders/scheduled-rides/{id} should cancel ride")
    void cancelScheduledRide_ShouldReturnOk() throws Exception {
        com.velo.platform.entities.RideRequest rideRequest = com.velo.platform.entities.RideRequest.builder()
                .rider(testRider)
                .rideRequestStatus(RideRequestStatus.SCHEDULED)
                .scheduledTime(LocalDateTime.now(ZoneId.of("UTC")).plusHours(1))
                .pickupLocation(com.velo.platform.utils.GeometryUtil.createPoint(new com.velo.platform.dto.PointDto(new double[]{77.5946, 12.9716})))
                .dropOffLocation(com.velo.platform.utils.GeometryUtil.createPoint(new com.velo.platform.dto.PointDto(new double[]{77.6101, 12.9307})))
                .paymentMethod(PaymentMethod.WALLET)
                .fare(java.math.BigDecimal.valueOf(100.0))
                .build();
        rideRequest = rideRequestRepository.save(rideRequest);

        mockMvc.perform(withRiderAuth(delete("/riders/scheduled-rides/" + rideRequest.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }
}
