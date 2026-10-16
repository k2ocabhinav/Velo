package com.velo.platform.dto.admin;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AdminLiveDispatchRideDto(
        Long rideId,
        Long rideRequestId,
        String status,
        String riderName,
        Long driverId,
        AdminLiveDispatchLocationDto pickup,
        AdminLiveDispatchLocationDto dropOff,
        OffsetDateTime requestedAt,
        OffsetDateTime startedAt,
        BigDecimal fare,
        boolean simulated
) { }
