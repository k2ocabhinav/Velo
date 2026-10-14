package com.velo.platform.controllers;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "management.endpoint.health.probes.enabled=true",
        "management.endpoint.health.show-details=when-authorized",
        "management.endpoint.health.roles=ADMIN",
        "management.health.redis.enabled=true"
})
class HealthGroupsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void readinessIncludesDatabaseAndDiskButExcludesRedis() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/actuator/health/readiness").with(user("ops").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.readinessState").exists())
                .andExpect(jsonPath("$.components.db").exists())
                .andExpect(jsonPath("$.components.diskSpace").exists())
                .andExpect(jsonPath("$.components.redis").doesNotExist());

        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk());
    }

    @Test
    void aggregateHealthShowsRedisDetailsToAdminOnly() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(result -> assertThat(result.getResponse().getStatus())
                        .isIn(HttpStatus.OK.value(), HttpStatus.SERVICE_UNAVAILABLE.value()))
                .andExpect(jsonPath("$.components").doesNotExist());

        mockMvc.perform(get("/actuator/health").with(user("ops").roles("ADMIN")))
                .andExpect(result -> assertThat(result.getResponse().getStatus())
                        .isIn(HttpStatus.OK.value(), HttpStatus.SERVICE_UNAVAILABLE.value()))
                .andExpect(jsonPath("$.components.redis").exists());
    }
}
