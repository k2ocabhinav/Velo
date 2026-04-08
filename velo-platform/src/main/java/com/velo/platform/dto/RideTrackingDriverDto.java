package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RideTrackingDriverDto {
    private Long id;
    private String name;
    private String vehicleId;
    private Double rating;
}
