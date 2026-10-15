package com.velo.platform.dto.admin;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AdminLiveDispatchRideDto(
        Long rideId,
        Long rideRequestId,
        String status,
        String riderName,
        Long driverId,
        AdminLiveDispatchLocationDto pickup,
        AdminLiveDispatchLocationDto dropOff,
        LocalDateTime requestedAt,
        LocalDateTime startedAt,
        BigDecimal fare,
        boolean simulated
) { }
