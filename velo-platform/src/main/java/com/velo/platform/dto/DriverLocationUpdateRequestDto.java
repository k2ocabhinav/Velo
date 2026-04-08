package com.velo.platform.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DriverLocationUpdateRequestDto {

    @NotNull(message = "Latitude is required")
    @DecimalMin(value = "-90.0", message = "Latitude must be >= -90")
    @DecimalMax(value = "90.0", message = "Latitude must be <= 90")
    private Double lat;

    @NotNull(message = "Longitude is required")
    @DecimalMin(value = "-180.0", message = "Longitude must be >= -180")
    @DecimalMax(value = "180.0", message = "Longitude must be <= 180")
    private Double lng;

    @DecimalMin(value = "0.0", message = "Heading must be >= 0")
    @DecimalMax(value = "360.0", message = "Heading must be <= 360")
    private Double heading;

    @DecimalMin(value = "0.0", message = "Speed must be >= 0")
    private Double speedKph;

    @DecimalMin(value = "0.0", message = "Accuracy must be >= 0")
    private Double accuracyM;

    private LocalDateTime capturedAt;
}
