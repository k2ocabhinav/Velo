package com.velo.platform.dto.admin;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TripSheetRiderOptionDto {
    Long riderId;
    String name;
    String email;
}
