package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminRideOfferDto {
    private Long offerId;
    private Long driverId;
    private String driverName;
    private String status;
    private LocalDateTime offeredAt;
    private LocalDateTime expiresAt;
    private LocalDateTime resolvedAt;
    private String resolutionReason;
}
