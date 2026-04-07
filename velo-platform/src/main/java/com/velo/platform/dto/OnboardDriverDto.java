package com.velo.platform.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OnboardDriverDto {
    @NotBlank(message = "Vehicle ID is required")
    private String vehicleId;
}
