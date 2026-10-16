package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class AdminDispatchAuditDto {
    private Long id;
    private String actionType;
    private Long actorUserId;
    private Long rideRequestId;
    private Long rideId;
    private Long previousDriverId;
    private Long nextDriverId;
    private String reason;
    private OffsetDateTime createdAt;
}
