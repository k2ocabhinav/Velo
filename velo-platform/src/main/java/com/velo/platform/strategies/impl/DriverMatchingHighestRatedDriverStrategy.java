package com.velo.platform.strategies.impl;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.strategies.DriverMatchingStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverMatchingHighestRatedDriverStrategy implements DriverMatchingStrategy {

    private final DriverRepository driverRepository;

    @Override
    public List<Driver> findMatchingDrivers(RideRequest rideRequest) {
        return driverRepository.findTenNearbyTopRatedDrivers(rideRequest.getPickupLocation());
    }
}
