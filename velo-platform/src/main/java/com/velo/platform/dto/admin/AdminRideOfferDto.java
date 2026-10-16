package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class AdminRideOfferDto {
    private Long offerId;
    private Long driverId;
    private String driverName;
    private String status;
    private OffsetDateTime offeredAt;
    private OffsetDateTime expiresAt;
    private OffsetDateTime resolvedAt;
    private String resolutionReason;
}
