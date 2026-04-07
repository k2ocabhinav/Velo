package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareEstimateRequestDto {
    @NotNull(message = "Pickup location is required")
    @Valid
    private PointDto pickupLocation;

    @NotNull(message = "Drop-off location is required")
    @Valid
    private PointDto dropOffLocation;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;

    private String promoCode;
}
