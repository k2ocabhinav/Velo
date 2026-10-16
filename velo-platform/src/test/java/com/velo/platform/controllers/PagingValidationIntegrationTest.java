package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class PagingValidationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String[] ADMIN = {"X-Test-User-Id", "41", "X-Test-Email", "admin@velo-platform.com",
            "X-Test-Role", "ADMIN", "X-Test-Tenant-Id", "1"};
    private static final String[] RIDER = {"X-Test-User-Id", "8", "X-Test-Email", "henry@example.com",
            "X-Test-Role", "RIDER", "X-Test-Tenant-Id", "1"};

    @Test
    void negativeAdminPageReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").param("page", "-1")
                        .header(ADMIN[0], ADMIN[1]).header(ADMIN[2], ADMIN[3])
                        .header(ADMIN[4], ADMIN[5]).header(ADMIN[6], ADMIN[7]))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"));
    }

    @Test
    void oversizedAdminPageSizeReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").param("size", "500")
                        .header(ADMIN[0], ADMIN[1]).header(ADMIN[2], ADMIN[3])
                        .header(ADMIN[4], ADMIN[5]).header(ADMIN[6], ADMIN[7]))
                .andExpect(status().isBadRequest());
    }

    @Test
    void negativeRiderPageOffsetReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/riders/getMyRides").param("pageOffset", "-1")
                        .header(RIDER[0], RIDER[1]).header(RIDER[2], RIDER[3])
                        .header(RIDER[4], RIDER[5]).header(RIDER[6], RIDER[7]))
                .andExpect(status().isBadRequest());
    }

    @Test
    void negativeNotificationPageReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/notifications").param("page", "-1")
                        .header(RIDER[0], RIDER[1]).header(RIDER[2], RIDER[3])
                        .header(RIDER[4], RIDER[5]).header(RIDER[6], RIDER[7]))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validPagingStillSucceeds() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").param("page", "0").param("size", "10")
                        .header(ADMIN[0], ADMIN[1]).header(ADMIN[2], ADMIN[3])
                        .header(ADMIN[4], ADMIN[5]).header(ADMIN[6], ADMIN[7]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }
}
