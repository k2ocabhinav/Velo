package com.velo.platform.strategies.impl;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.strategies.DriverMatchingStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DriverMatchingNearestDriverStrategy implements DriverMatchingStrategy {

    private static final int MAX_MATCHED_DRIVERS = 10;
    private final DriverRepository driverRepository;

    @Override
    public List<Driver> findMatchingDrivers(RideRequest rideRequest) {
        Long tenantId = rideRequest.getTenantId() == null ? 1L : rideRequest.getTenantId();
        List<Driver> nearest = rideRequest.getPickupLocation() == null
                ? List.of()
                : driverRepository.findTenNearestDrivers(rideRequest.getPickupLocation(), tenantId);

        if (nearest.size() >= MAX_MATCHED_DRIVERS) {
            return nearest;
        }

        List<Driver> fallback = driverRepository.findFallbackDrivers(tenantId, MAX_MATCHED_DRIVERS);
        Map<Long, Driver> merged = new LinkedHashMap<>();

        for (Driver driver : nearest) {
            merged.put(driver.getId(), driver);
        }
        for (Driver driver : fallback) {
            merged.putIfAbsent(driver.getId(), driver);
        }

        return merged.values().stream().limit(MAX_MATCHED_DRIVERS).toList();
    }
}
