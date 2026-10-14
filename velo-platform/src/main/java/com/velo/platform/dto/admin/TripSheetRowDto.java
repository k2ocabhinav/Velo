package com.velo.platform.dto.admin;

import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.ScheduledTripReasonCode;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class TripSheetRowDto {
    Long rideRequestId;
    Long recurringTemplateId;
    LocalDateTime scheduledTime;
    String bookingReference;
    String riderName;
    String pickupAddress;
    String dropOffAddress;
    String driverName;
    boolean assigned;
    boolean needsAttention;
    RideRequestStatus status;
    ScheduledTripReasonCode reasonCode;
    String reasonNote;
}
