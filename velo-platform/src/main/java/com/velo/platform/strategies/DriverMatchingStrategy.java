package com.velo.platform.strategies;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideRequest;

import java.util.List;

public interface DriverMatchingStrategy {
    List<Driver> findMatchingDrivers(RideRequest rideRequest);
}
