package com.velo.platform.controllers;

import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.services.GeocodingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
class GeocodingControllerIntegrationTest {
    @Autowired private MockMvc mockMvc;
    @MockBean private GeocodingService geocodingService;

    @Test
    @WithMockUser(roles = "RIDER")
    void searchReturnsNormalizedSuggestionsInApiEnvelope() throws Exception {
        when(geocodingService.search("Central Market", "12.9,77.5"))
                .thenReturn(List.of(new GeocodingResultDto("Central Market, Bengaluru", 12.9, 77.5, "market")));

        mockMvc.perform(get("/geo/search").param("q", "Central Market").param("near", "12.9,77.5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].label").value("Central Market, Bengaluru"))
                .andExpect(jsonPath("$.data[0].lat").value(12.9))
                .andExpect(jsonPath("$.data[0].lon").value(77.5))
                .andExpect(jsonPath("$.data[0].type").value("market"));
    }

    @Test
    @WithMockUser(roles = "DRIVER")
    void reverseReturnsAddressForCoordinates() throws Exception {
        when(geocodingService.reverse(12.9, 77.5))
                .thenReturn(new GeocodingResultDto("Main Road, Bengaluru", 12.9, 77.5, "road"));

        mockMvc.perform(get("/geo/reverse").param("lat", "12.9").param("lon", "77.5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.label").value("Main Road, Bengaluru"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void providerFailureReturns503WithActionableMessage() throws Exception {
        when(geocodingService.search("Airport", null)).thenThrow(new GeocodingUnavailableException());

        mockMvc.perform(get("/geo/search").param("q", "Airport"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.message").value("The address service is temporarily unavailable. Please try again."));
    }

    @Test
    @WithMockUser(roles = "USER")
    void otherRolesCannotUseGeocoding() throws Exception {
        mockMvc.perform(get("/geo/search").param("q", "Airport"))
                .andExpect(status().isForbidden());
    }
}
