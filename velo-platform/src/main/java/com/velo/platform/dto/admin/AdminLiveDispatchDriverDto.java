package com.velo.platform.dto.admin;

import java.time.LocalDateTime;

public record AdminLiveDispatchDriverDto(
        Long driverId,
        String name,
        String vehiclePlate,
        Double rating,
        String status,
        Double lat,
        Double lng,
        Double heading,
        Double speedKph,
        LocalDateTime locationUpdatedAt,
        boolean stale,
        boolean simulated,
        Long rideId
) { }
