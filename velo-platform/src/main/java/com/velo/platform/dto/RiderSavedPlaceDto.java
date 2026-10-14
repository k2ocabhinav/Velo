package com.velo.platform.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RiderSavedPlaceDto {
    private Long id;
    private String name;
    private String label;
    private double lat;
    private double lon;
    private String type;
}
