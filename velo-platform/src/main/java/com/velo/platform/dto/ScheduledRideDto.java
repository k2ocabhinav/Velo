package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledRideDto {
    private Long id;
    private PointDto pickupLocation;
    private PointDto dropOffLocation;
    private PaymentMethod paymentMethod;
    private BigDecimal fare;
    private LocalDateTime scheduledTime;
    private RideRequestStatus status;
    private LocalDateTime requestedTime;
}
