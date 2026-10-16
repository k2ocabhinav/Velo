package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledRideDto {
    private Long id;
    private PointDto pickupLocation;
    private PointDto dropOffLocation;
    private PaymentMethod paymentMethod;
    private BigDecimal fare;
    /** UTC instant, serialized with its offset so clients render it in the viewer's zone. */
    private OffsetDateTime scheduledTime;
    private RideRequestStatus status;
    private LocalDateTime requestedTime;
}
