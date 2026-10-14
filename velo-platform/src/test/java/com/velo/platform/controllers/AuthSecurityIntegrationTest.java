package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.JwtTokenProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthSecurityIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private ObjectMapper objectMapper;

    @Test
    @DisplayName("Driver onboarding requires authentication and is limited to self or a same-tenant admin")
    void onboarding_ShouldRequireAuthenticationAndEnforceOwnership() throws Exception {
        User rider = createUser(Role.RIDER, 1L);
        User sameTenantTarget = createUser(Role.RIDER, 1L);
        User otherTenantTarget = createUser(Role.RIDER, 2L);
        User admin = createUser(Role.ADMIN, 1L);
        String requestBody = "{\"vehicleId\":\"vehicle-1\"}";

        mockMvc.perform(post("/auth/onBoardNewDriver/{userId}", rider.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/auth/onBoardNewDriver/{userId}", sameTenantTarget.getId())
                        .header("Authorization", bearer(rider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/auth/onBoardNewDriver/{userId}", rider.getId())
                        .header("Authorization", bearer(rider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/auth/onBoardNewDriver/{userId}", sameTenantTarget.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/auth/onBoardNewDriver/{userId}", otherTenantTarget.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("A bearer token is applied to the authenticated auth profile route")
    void profile_ShouldAcceptBearerToken() throws Exception {
        User user = createUser(Role.RIDER, 1L);

        mockMvc.perform(put("/auth/profile")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "firstName", "Updated", "lastName", "Rider", "phoneNumber", "+15550001000"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(user.getEmail()));

        org.assertj.core.api.Assertions.assertThat(userRepository.findById(user.getId()).orElseThrow().getFirstName())
                .isEqualTo("Updated");
    }

    @Test
    @DisplayName("Only actuator health is public")
    void actuator_ShouldExposeHealthWithoutAuthenticationOnly() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(result -> org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus())
                        .isIn(HttpStatus.OK.value(), HttpStatus.SERVICE_UNAVAILABLE.value()));

        mockMvc.perform(get("/actuator/env"))
                .andExpect(status().isForbidden());
    }

    private User createUser(Role role, Long tenantId) {
        User user = User.builder()
                .email(UUID.randomUUID() + "@example.test")
                .firstName("Test")
                .lastName("User")
                .password("encoded-password")
                .active(true)
                .tenantId(tenantId)
                .roles(new HashSet<>(Set.of(role)))
                .build();
        return userRepository.saveAndFlush(user);
    }

    private String bearer(User user) {
        Role role = user.getRoles().iterator().next();
        return "Bearer " + jwtTokenProvider.generateToken(
                user.getEmail(), user.getId(), role.name(), user.getTenantId());
    }
}
