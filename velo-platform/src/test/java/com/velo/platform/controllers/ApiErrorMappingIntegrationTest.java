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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class ApiErrorMappingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String[] ADMIN = {"X-Test-User-Id", "41", "X-Test-Email", "admin@velo-platform.com",
            "X-Test-Role", "ADMIN", "X-Test-Tenant-Id", "1"};

    @Test
    void missingRequestBodyReturnsBadRequestEnvelope() throws Exception {
        mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.error.message").value("Required request body is missing or malformed"));
    }

    @Test
    void malformedJsonBodyReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not valid json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Required request body is missing or malformed"));
    }

    @Test
    void missingRequiredRequestParameterReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/admin/trip-sheet").header(ADMIN[0], ADMIN[1]).header(ADMIN[2], ADMIN[3])
                        .header(ADMIN[4], ADMIN[5]).header(ADMIN[6], ADMIN[7]))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.error.message").value("Missing required parameter 'date'"));
    }

    @Test
    void invalidParameterTypeReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/admin/stats/daily").param("date", "notadate")
                        .header(ADMIN[0], ADMIN[1]).header(ADMIN[2], ADMIN[3])
                        .header(ADMIN[4], ADMIN[5]).header(ADMIN[6], ADMIN[7]))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.error.message").value("Invalid value for parameter 'date'"));
    }

    @Test
    void unsupportedMethodReturnsMethodNotAllowed() throws Exception {
        mockMvc.perform(get("/api/v1/admin/drivers/1/approve")
                        .header(ADMIN[0], ADMIN[1]).header(ADMIN[2], ADMIN[3])
                        .header(ADMIN[4], ADMIN[5]).header(ADMIN[6], ADMIN[7]))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.status").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void unsupportedMediaTypeReturnsUnsupportedMediaType() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_XML)
                        .content("<credentials/>"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error.status").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void unmappedPathReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.status").value("NOT_FOUND"));
    }
}
