package com.velo.platform.services;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.DriverLocationDto;
import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.Driver;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.List;

public interface DriverService {

    RideDto acceptRide(Long rideId);

    RideDto cancelRide(Long rideId);

    RideDto startRide(Long rideId, String otp);

    RideDto endRide(Long rideId);

    RiderDto rateRider(Long rideId, Integer rating);

    DriverDto getMyProfile();

    Page<RideDto> getAllMyRides(PageRequest pageRequest);

    Driver getCurrentDriver();

    DriverDto updateDriverAvailability(boolean available);

    DriverDto updateDriverAvailability(Driver driver, boolean available);

    DriverLocationDto updateDriverLocation(DriverLocationUpdateRequestDto locationUpdate);

    Driver createNewDriver(Driver driver);
}
