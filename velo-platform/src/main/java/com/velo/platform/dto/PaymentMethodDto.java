package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethodType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentMethodDto {
    private Long id;
    private PaymentMethodType type;
    private String lastFourDigits;
    private String expiryDate;
    private Boolean isDefault;
}