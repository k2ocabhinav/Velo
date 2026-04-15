package com.velo.platform.dto.admin;

import com.velo.platform.dto.PointDto;
import com.velo.platform.entities.enums.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdminCreateDispatchRequestDto {

    @NotNull(message = "Pickup location is required")
    @Valid
    private PointDto pickupLocation;

    @NotNull(message = "Drop-off location is required")
    @Valid
    private PointDto dropOffLocation;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;

    private String customerName;
    private String customerPhone;
    private String pickupAddress;
    private String dropOffAddress;
    private String externalReference;
}
