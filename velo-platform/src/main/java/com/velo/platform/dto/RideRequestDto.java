package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RideRequestDto {
    private Long id;

    @NotNull(message = "Pickup location is required")
    @Valid
    private PointDto pickupLocation;

    @NotNull(message = "Drop-off location is required")
    @Valid
    private PointDto dropOffLocation;

    private String pickupAddress;

    private String dropOffAddress;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;

    private OffsetDateTime requestedTime;

    private Double fare;
    private String promoCode;
    private Double discountAmount;
    private RiderDto rider;

    private RideRequestStatus rideRequestStatus;

    /** UTC instant with offset (ISO-8601 with zone) for a scheduled trip; null for immediate requests. */
    private OffsetDateTime scheduledTime;

    private OffsetDateTime expiresAt;
}
