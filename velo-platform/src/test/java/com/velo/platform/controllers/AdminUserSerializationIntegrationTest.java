package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.admin.AdminUserDto;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.services.AdminDispatchService;
import com.velo.platform.services.AdminService;
import com.velo.platform.services.PayoutService;
import com.velo.platform.services.ScheduledRideService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class AdminUserSerializationIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private AdminService adminService;
    @MockBean private AdminDispatchService adminDispatchService;
    @MockBean private PayoutService payoutService;
    @MockBean private ScheduledRideService scheduledRideService;

    @Test
    void adminUsersEndpointOmitsPasswordField() throws Exception {
        AdminUserDto user = AdminUserDto.builder()
                .id(12L)
                .firstName("Ada")
                .lastName("Rider")
                .email("ada@example.com")
                .active(true)
                .tenantId(1L)
                .roles(Set.of(Role.RIDER))
                .build();
        when(adminService.getAllUsers(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(user)));

        mockMvc.perform(get("/api/v1/admin/users")
                        .header("X-Test-User-Id", "1")
                        .header("X-Test-Email", "admin@test.com")
                        .header("X-Test-Role", "ROLE_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].email").value("ada@example.com"))
                .andExpect(jsonPath("$.data.content[0].password").doesNotExist());
    }

    @Test
    void userEntitySerializationAlsoIgnoresPassword() throws Exception {
        User user = User.builder().email("hash-safe@example.com").password("bcrypt-hash").build();

        var json = objectMapper.readTree(objectMapper.writeValueAsBytes(user));

        org.assertj.core.api.Assertions.assertThat(json.has("password")).isFalse();
    }
}
