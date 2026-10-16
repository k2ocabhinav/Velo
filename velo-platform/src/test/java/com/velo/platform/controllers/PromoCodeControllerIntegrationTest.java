package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.dto.PromoCodeDto;
import com.velo.platform.entities.enums.DiscountType;
import com.velo.platform.services.PromoCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PromoCodeControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PromoCodeService promoCodeService;

    private PromoCodeDto promoCodeDto;

    @BeforeEach
    void setUp() {
        promoCodeDto = PromoCodeDto.builder()
                .code("WELCOME20")
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(BigDecimal.valueOf(20))
                .active(true)
                .build();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void createPromoCode_ByAdmin_ShouldReturn200() throws Exception {
        when(promoCodeService.createPromoCode(any(PromoCodeDto.class))).thenReturn(promoCodeDto);

        mockMvc.perform(post("/api/v1/admin/promo-codes")
                .header("X-Test-User-Id", "1")
                .header("X-Test-Email", "admin@test.com")
                .header("X-Test-Role", "ROLE_ADMIN")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(promoCodeDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("WELCOME20"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void createPromoCode_WithoutCode_ShouldReturn400() throws Exception {
        PromoCodeDto invalid = PromoCodeDto.builder()
                .discountType(DiscountType.FLAT)
                .discountValue(BigDecimal.TEN)
                .build();

        mockMvc.perform(post("/api/v1/admin/promo-codes")
                .header("X-Test-User-Id", "1")
                .header("X-Test-Email", "admin@test.com")
                .header("X-Test-Role", "ROLE_ADMIN")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void createPromoCode_WithNonPositiveDiscount_ShouldReturn400() throws Exception {
        PromoCodeDto invalid = PromoCodeDto.builder()
                .code("NEG")
                .discountType(DiscountType.FLAT)
                .discountValue(BigDecimal.valueOf(-5))
                .build();

        mockMvc.perform(post("/api/v1/admin/promo-codes")
                .header("X-Test-User-Id", "1")
                .header("X-Test-Email", "admin@test.com")
                .header("X-Test-Role", "ROLE_ADMIN")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"));
    }

    @Test
    @WithMockUser(roles = "RIDER")
    void createPromoCode_ByRider_ShouldReturn403() throws Exception {
        mockMvc.perform(post("/api/v1/admin/promo-codes")
                .header("X-Test-User-Id", "2")
                .header("X-Test-Email", "rider@test.com")
                .header("X-Test-Role", "ROLE_RIDER")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(promoCodeDto)))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getAllPromoCodes_ByAdmin_ShouldReturnList() throws Exception {
        when(promoCodeService.getAllPromoCodes()).thenReturn(List.of(promoCodeDto));

        mockMvc.perform(get("/api/v1/admin/promo-codes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("WELCOME20"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updatePromoCode_ByAdmin_ShouldReturn200() throws Exception {
        when(promoCodeService.updatePromoCode(anyLong(), any(PromoCodeDto.class))).thenReturn(promoCodeDto);

        mockMvc.perform(put("/api/v1/admin/promo-codes/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(promoCodeDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("WELCOME20"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updatePromoCode_WithInvalidDateRange_ShouldReturn400() throws Exception {
        PromoCodeDto invalid = PromoCodeDto.builder()
                .code("BAD-DATES")
                .discountType(DiscountType.FLAT)
                .discountValue(BigDecimal.TEN)
                .startDate(java.time.LocalDate.of(2026, 12, 2))
                .endDate(java.time.LocalDate.of(2026, 12, 1))
                .build();

        mockMvc.perform(put("/api/v1/admin/promo-codes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updatePromoCode_WithNegativeMaxUses_ShouldReturn400() throws Exception {
        PromoCodeDto invalid = PromoCodeDto.builder()
                .code("BAD-USES")
                .discountType(DiscountType.FLAT)
                .discountValue(BigDecimal.TEN)
                .maxUses(-1)
                .build();

        mockMvc.perform(put("/api/v1/admin/promo-codes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updatePromoCode_WithNonPositiveDiscount_ShouldReturn400() throws Exception {
        PromoCodeDto invalid = PromoCodeDto.builder()
                .code("BAD-DISCOUNT")
                .discountType(DiscountType.FLAT)
                .discountValue(BigDecimal.ZERO)
                .build();

        mockMvc.perform(put("/api/v1/admin/promo-codes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void deactivatePromoCode_ByAdmin_ShouldReturn200() throws Exception {
        when(promoCodeService.deactivatePromoCode(anyLong())).thenReturn(promoCodeDto);

        mockMvc.perform(post("/api/v1/admin/promo-codes/1/deactivate"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "RIDER")
    void getActivePromoCodes_ByRider_ShouldReturnList() throws Exception {
        when(promoCodeService.getActivePromoCodes()).thenReturn(List.of(promoCodeDto));

        mockMvc.perform(get("/promo-codes/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("WELCOME20"));
    }
}
