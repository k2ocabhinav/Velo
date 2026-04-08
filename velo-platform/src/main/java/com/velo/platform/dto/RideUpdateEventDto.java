package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RideUpdateEventDto {
    private String eventType;
    private Long rideId;
    private Long rideRequestId;
    private String status;
    private Long riderId;
    private Long driverId;
    private RideLocationDto driverLocation;
    private Integer etaMinutes;
    private String routePolyline;
    private LocalDateTime updatedAt;
}
