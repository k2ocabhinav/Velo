package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DriverLocationDto {
    private Double lat;
    private Double lng;
    private Double heading;
    private Double speedKph;
    private Double accuracyM;
    private LocalDateTime capturedAt;
    private LocalDateTime updatedAt;
}
