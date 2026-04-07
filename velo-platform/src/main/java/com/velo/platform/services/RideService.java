package com.velo.platform.services;

import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.RideStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

public interface RideService {

    Ride getRideById(Long rideId);

    Ride createNewRide(RideRequest rideRequest, Driver driver);

    Ride updateRideStatus(Ride ride, RideStatus rideStatus);

    Page<Ride> getAllRidesOfRider(Rider rider, PageRequest pageRequest);

    Page<Ride> getAllRidesOfDriver(Driver driver, PageRequest pageRequest);
}
