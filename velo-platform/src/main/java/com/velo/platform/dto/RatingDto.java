package com.velo.platform.dto;

import lombok.Data;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Data
public class RatingDto {
    private Long rideId;

    @NotNull
    @Min(1)
    @Max(5)
    private Integer rating;
}
