package com.velo.platform.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "staging"})
class DocsEndpointStagingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Staging profile should hide OpenAPI docs")
    void apiDocs_ShouldBeHiddenInStagingProfile() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(result -> assertTrue(
                        result.getResponse().getStatus() >= 400,
                        "OpenAPI docs must not be publicly reachable in staging"
                ));
    }

    @Test
    @DisplayName("Staging profile should hide Swagger UI")
    void swaggerUi_ShouldBeHiddenInStagingProfile() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(result -> assertTrue(
                        result.getResponse().getStatus() >= 400,
                        "Swagger UI must not be publicly reachable in staging"
                ));
    }
}
