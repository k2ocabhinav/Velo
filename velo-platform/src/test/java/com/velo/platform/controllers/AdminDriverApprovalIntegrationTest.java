package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.DriverRepository;
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

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class AdminDriverApprovalIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private DriverRepository driverRepository;

    private User admin;
    private Driver pendingDriver;

    @BeforeEach
    void setUp() {
        driverRepository.deleteAll();
        userRepository.deleteAll();

        admin = userRepository.save(user("admin@test.com", Role.ADMIN));
        pendingDriver = driverRepository.save(Driver.builder()
                .user(userRepository.save(user("pending@test.com", Role.DRIVER)))
                .tenantId(1L)
                .rating(0.0)
                .available(false)
                .onboardingStatus(DriverOnboardingStatus.PENDING)
                .build());
    }

    private User user(String email, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("password123");
        user.setRoles(Set.of(role));
        user.setActive(true);
        user.setTenantId(1L);
        return user;
    }

    private MockHttpServletRequestBuilder withAdminAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", admin.getId())
                .header("X-Test-Email", admin.getEmail())
                .header("X-Test-Role", Role.ADMIN.name())
                .header("X-Test-Tenant-Id", "1");
    }

    @Test
    @DisplayName("Rejecting a driver persists and trims the reason")
    void rejectDriver_ShouldPersistReason() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/drivers/" + pendingDriver.getId() + "/reject"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"  Documents incomplete  "}
                                """))
                .andExpect(status().isOk());

        Driver reloaded = driverRepository.findById(pendingDriver.getId()).orElseThrow();
        assertThat(reloaded.getOnboardingStatus()).isEqualTo(DriverOnboardingStatus.REJECTED);
        assertThat(reloaded.getRejectionReason()).isEqualTo("Documents incomplete");
    }

    @Test
    @DisplayName("Rejecting a driver without a reason returns 400")
    void rejectDriver_WithoutReason_ShouldReturn400() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/drivers/" + pendingDriver.getId() + "/reject"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Rejecting an unknown driver returns 404")
    void rejectDriver_UnknownDriver_ShouldReturn404() throws Exception {
        mockMvc.perform(withAdminAuth(post("/api/v1/admin/drivers/999999/reject"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Missing"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Rejecting another tenant's driver returns 404 without revealing it")
    void rejectDriver_CrossTenant_ShouldReturn404() throws Exception {
        Driver otherTenantDriver = driverRepository.save(Driver.builder()
                .user(userRepository.save(user("other-pending@test.com", Role.DRIVER)))
                .tenantId(2L)
                .rating(0.0)
                .available(false)
                .onboardingStatus(DriverOnboardingStatus.PENDING)
                .build());

        mockMvc.perform(withAdminAuth(post("/api/v1/admin/drivers/" + otherTenantDriver.getId() + "/reject"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Missing"}
                                """))
                .andExpect(status().isNotFound());

        assertThat(driverRepository.findById(otherTenantDriver.getId()).orElseThrow().getOnboardingStatus())
                .isEqualTo(DriverOnboardingStatus.PENDING);
    }
}
