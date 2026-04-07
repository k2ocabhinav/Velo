package com.velo.platform.services;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.Ride;

public interface RatingService {
    DriverDto rateDriver(Ride ride, Integer rating);
    RiderDto rateRider(Ride ride, Integer rating);

    void createNewRating(Ride ride);
}
