package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareEstimateDto {
    private BigDecimal estimatedFare; // retained for backward compatibility
    private BigDecimal baseFare;
    private BigDecimal originalFare;
    private BigDecimal discountedFare;
    private BigDecimal savings;
    private Boolean promoApplied;
    private String promoMessage;
    private Double surgeMultiplier;
    private BigDecimal discountAmount; // discount applied
    private Double distanceKm;
    private Integer durationMinutes;
    private Boolean walletSufficient;
    private LocalDateTime estimatedPickupTime;
    private List<PromoCodeDto> applicablePromos;
}
