package com.velo.platform.strategies.impl;

import com.velo.platform.configs.FareConfig;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.services.DistanceService;
import com.velo.platform.services.TenantTariffService;
import com.velo.platform.strategies.RideFareCalculationStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;


@Service
@RequiredArgsConstructor
public class RideFareSurgePricingFareCalculationStrategy implements RideFareCalculationStrategy {

    private final DistanceService distanceService;
    private final FareConfig fareConfig;
    private final TenantTariffService tenantTariffService;

    @Override
    public BigDecimal calculateFare(RideRequest rideRequest) {
        double distance = distanceService.calculateDistance(rideRequest.getPickupLocation(),
                rideRequest.getDropOffLocation());
        return tenantTariffService.findForTenant(rideRequest.getTenantId())
                .calculate(distance, BigDecimal.valueOf(fareConfig.getSurgeMultiplier()));
    }
}
