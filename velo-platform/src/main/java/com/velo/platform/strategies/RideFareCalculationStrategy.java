package com.velo.platform.strategies;

import com.velo.platform.entities.RideRequest;
import java.math.BigDecimal;

public interface RideFareCalculationStrategy {
    BigDecimal calculateFare(RideRequest rideRequest);
}
