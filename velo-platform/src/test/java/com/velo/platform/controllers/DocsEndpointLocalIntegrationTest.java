package com.velo.platform.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocsEndpointLocalIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Local/test profile should expose OpenAPI docs")
    void apiDocs_ShouldBeAccessibleInTestProfile() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String contentType = result.getResponse().getContentType();
                    org.junit.jupiter.api.Assertions.assertTrue(
                            contentType != null && contentType.contains(MediaType.APPLICATION_JSON_VALUE),
                            "OpenAPI docs should be returned as JSON"
                    );
                });
    }

    @Test
    @DisplayName("Local/test profile should expose Swagger UI")
    void swaggerUi_ShouldBeAccessibleInTestProfile() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Protected endpoints should remain protected while docs stay public")
    void protectedEndpoint_ShouldStillRequireAuthentication() throws Exception {
        mockMvc.perform(get("/auth/profile"))
                .andExpect(status().is4xxClientError());
    }
}
