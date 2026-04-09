package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class AdminActiveRideDto {
    private Long rideId;
    private Long riderId;
    private String riderName;
    private Long driverId;
    private String driverName;
    private String status;
    private BigDecimal fare;
    private LocalDateTime createdTime;
    private LocalDateTime startedAt;
}
