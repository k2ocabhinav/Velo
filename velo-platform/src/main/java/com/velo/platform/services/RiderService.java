package com.velo.platform.services;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.RideTrackingDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.List;

public interface RiderService {

    RideRequestDto requestRide(RideRequestDto rideRequestDto);

    RideDto cancelRide(Long rideId);

    RideRequestDto cancelRideRequest(Long rideRequestId);
    RideDto endRide(Long rideId);

    DriverDto rateDriver(Long rideId, Integer rating);

    RiderDto getMyProfile();

    Page<RideDto> getAllMyRides(PageRequest pageRequest);

    RideRequestDto getCurrentRideRequest();

    RideTrackingDto getActiveRideTracking();

    Rider createNewRider(User user);

    Rider getCurrentRider();
}
