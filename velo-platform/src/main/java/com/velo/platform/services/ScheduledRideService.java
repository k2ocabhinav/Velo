package com.velo.platform.services;

import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.ScheduledRideDto;
import com.velo.platform.entities.enums.ScheduledTripReasonCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;

public interface ScheduledRideService {

    ScheduledRideDto scheduleRide(RideRequestDto rideRequestDto);

    ScheduledRideDto cancelScheduledRide(Long rideRequestId);

    ScheduledRideDto cancelScheduledRide(Long rideRequestId, ScheduledTripReasonCode reasonCode, String reasonNote);

    ScheduledRideDto rescheduleRide(Long rideRequestId, LocalDateTime newScheduledTime);

    Page<ScheduledRideDto> getMyScheduledRides(PageRequest pageRequest);

    Page<ScheduledRideDto> getAllScheduledRides(PageRequest pageRequest);

    int dispatchScheduledRides();
}
