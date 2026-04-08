package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RideTrackingDto {
    private Long rideId;
    private Long rideRequestId;
    private String status;
    private PointDto pickupLocation;
    private PointDto dropOffLocation;
    private RideTrackingDriverDto driver;
    private RideLocationDto lastDriverLocation;
    private Integer etaMinutes;
    private String routePolyline;
    private LocalDateTime updatedAt;
    private Boolean canCancel;
}
