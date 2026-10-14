package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class TenantBrandingValidationIntegrationTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void updateBrandingRejectsNonHexPrimaryColor() throws Exception {
        mockMvc.perform(put("/api/v1/admin/branding")
                        .header("X-Test-User-Id", "1")
                        .header("X-Test-Email", "admin@test.com")
                        .header("X-Test-Role", "ROLE_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "brandName": "Tenant",
                                  "primaryColor": "red; background: url(javascript:alert(1))",
                                  "riderLabel": "Rider",
                                  "driverLabel": "Driver",
                                  "tripLabel": "Trip",
                                  "dispatchMode": "RIDE_HAILING"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
