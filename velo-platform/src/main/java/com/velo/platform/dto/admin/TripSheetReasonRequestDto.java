package com.velo.platform.dto.admin;

import com.velo.platform.entities.enums.ScheduledTripReasonCode;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TripSheetReasonRequestDto {
    private ScheduledTripReasonCode reasonCode;

    @Size(max = 1024)
    private String note;
}
