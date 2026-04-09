package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminOpsHealthDto {
    private boolean redisAvailable;
    private double cacheHits;
    private double cacheMisses;
    private double cacheErrors;
    private long totalRides;
    private long totalDrivers;
    private long totalRiders;
    private long pendingRideRequests;
    private long dispatchQueueDepth;
    private long expiredOfferCount;
    private LocalDateTime updatedAt;
}
