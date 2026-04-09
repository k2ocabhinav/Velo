package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class AdminPendingRideRequestDto {
    private Long rideRequestId;
    private Long riderId;
    private String riderName;
    private String status;
    private BigDecimal fare;
    private LocalDateTime requestedTime;
    private Long offeredDriverCount;
}
