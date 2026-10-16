package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.admin.AdminCreateDispatchRequestDto;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.GeocodingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class AdminDispatchRequestLabelIntegrationTest {

    private static final double PICKUP_LAT = 12.9716;
    private static final double PICKUP_LNG = 77.5946;
    private static final double DROP_OFF_LAT = 12.9352;
    private static final double DROP_OFF_LNG = 77.6245;

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TenantRepository tenantRepository;
    @MockBean private GeocodingService geocodingService;

    private Long tenantId;

    @BeforeEach
    void setUp() {
        Tenant tenant = tenantRepository.findById(1L).orElseGet(() -> tenantRepository.save(Tenant.builder()
                .slug("dispatch-label-" + UUID.randomUUID())
                .name("Dispatch Label Test")
                .build()));
        tenant.setActive(true);
        tenant.setBaseFare(new BigDecimal("5.00"));
        tenant.setPerKmRate(new BigDecimal("2.00"));
        tenant.setMinimumFare(BigDecimal.ZERO);
        tenantId = tenantRepository.save(tenant).getId();
    }

    @Test
    @DisplayName("A dispatch request with coordinates only is labelled from reverse geocoding")
    void createDispatchRequest_ShouldFillMissingLabels() throws Exception {
        when(geocodingService.reverse(PICKUP_LAT, PICKUP_LNG)).thenReturn(new GeocodingResultDto(
                "MG Road, Bengaluru", "MG Road, Bengaluru, Karnataka, India", PICKUP_LAT, PICKUP_LNG, "road"));
        when(geocodingService.reverse(DROP_OFF_LAT, DROP_OFF_LNG)).thenReturn(new GeocodingResultDto(
                "Koramangala, Bengaluru", "Koramangala, Bengaluru, Karnataka, India", DROP_OFF_LAT, DROP_OFF_LNG, "suburb"));

        mockMvc.perform(withAdmin(post("/api/v1/admin/dispatch/requests"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(null, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pickupAddress").value("MG Road, Bengaluru"))
                .andExpect(jsonPath("$.data.dropOffAddress").value("Koramangala, Bengaluru"));
    }

    @Test
    @DisplayName("An address the admin typed is kept and reverse geocoding is skipped")
    void createDispatchRequest_ShouldKeepProvidedLabels() throws Exception {
        mockMvc.perform(withAdmin(post("/api/v1/admin/dispatch/requests"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson("Kempegowda International Airport, Terminal 1", "MG Road")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pickupAddress").value("Kempegowda International Airport, Terminal 1"))
                .andExpect(jsonPath("$.data.dropOffAddress").value("MG Road"));

        verifyNoInteractions(geocodingService);
    }

    @Test
    @DisplayName("The dispatch request still succeeds when reverse geocoding is unavailable")
    void createDispatchRequest_ShouldSucceedWithoutLabelsWhenGeocodingFails() throws Exception {
        when(geocodingService.reverse(anyDouble(), anyDouble())).thenThrow(new GeocodingUnavailableException());

        mockMvc.perform(withAdmin(post("/api/v1/admin/dispatch/requests"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(null, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.pickupAddress").value(nullValue()))
                .andExpect(jsonPath("$.data.dropOffAddress").value(nullValue()));
    }

    private MockHttpServletRequestBuilder withAdmin(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", "1")
                .header("X-Test-Email", "admin@test.com")
                .header("X-Test-Role", Role.ADMIN.name())
                .header("X-Test-Tenant-Id", String.valueOf(tenantId));
    }

    private String requestJson(String pickupAddress, String dropOffAddress) throws Exception {
        AdminCreateDispatchRequestDto requestDto = new AdminCreateDispatchRequestDto();
        requestDto.setPickupLocation(new PointDto(new double[]{PICKUP_LNG, PICKUP_LAT}));
        requestDto.setDropOffLocation(new PointDto(new double[]{DROP_OFF_LNG, DROP_OFF_LAT}));
        requestDto.setPaymentMethod(PaymentMethod.CASH);
        requestDto.setPickupAddress(pickupAddress);
        requestDto.setDropOffAddress(dropOffAddress);
        return objectMapper.writeValueAsString(requestDto);
    }
}
