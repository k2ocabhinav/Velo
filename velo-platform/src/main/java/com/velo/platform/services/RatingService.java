package com.velo.platform.services;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.Ride;

import java.util.List;

public interface RatingService {
    DriverDto rateDriver(Ride ride, Integer rating);
    RiderDto rateRider(Ride ride, Integer rating);

    void createNewRating(Ride ride);

    /**
     * Fills the "already rated" flags on the given rides in a single batched lookup, so screens can
     * hide the rate control without an N+1 query per ride.
     */
    void applyRideRatingFlags(List<RideDto> rides);
}
