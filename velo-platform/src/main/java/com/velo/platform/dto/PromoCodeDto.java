package com.velo.platform.dto;

import com.velo.platform.entities.enums.DiscountType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromoCodeDto {
    private Long id;
    @NotBlank(message = "Promo code is required")
    private String code;
    @NotNull(message = "Discount type is required")
    private DiscountType discountType;
    @NotNull(message = "Discount value is required")
    @DecimalMin(value = "0.01", message = "Discount value must be greater than zero")
    private BigDecimal discountValue;
    private Integer maxUses;
    private Integer currentUses;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal minRideFare;
    private Boolean active;
    private String description;
}
