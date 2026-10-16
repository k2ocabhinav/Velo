package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethodType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @NotNull(message = "Payment method type is required")
    private PaymentMethodType type;
    @Pattern(regexp = "\\d{4}", message = "Last four digits must be exactly four digits")
    private String lastFourDigits;
    @Size(max = 10, message = "Expiry date must be at most 10 characters")
    private String expiryDate;
    private Boolean isDefault;
}