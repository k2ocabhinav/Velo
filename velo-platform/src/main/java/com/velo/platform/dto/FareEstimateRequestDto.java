package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareEstimateRequestDto {
    private PointDto pickupLocation;
    private PointDto dropOffLocation;
    private PaymentMethod paymentMethod;
    private String promoCode;
}
