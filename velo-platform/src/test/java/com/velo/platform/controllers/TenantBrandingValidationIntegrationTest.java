package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.TenantRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class TenantBrandingValidationIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TenantRepository tenantRepository;

    @Test
    void publicBrandingEndpointReturnsTenantScopedCacheableBranding() throws Exception {
        String slug = "ui6-" + UUID.randomUUID().toString().substring(0, 8);
        tenantRepository.save(Tenant.builder().slug(slug).name("Northstar").active(true).build());

        mockMvc.perform(get("/api/v1/public/tenant/branding").param("tenant", slug))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=60, stale-while-revalidate=60"))
                .andExpect(jsonPath("$.data.brandName").value("Velo"))
                .andExpect(jsonPath("$.data.primaryColor").value("#2563EB"));
    }

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
