package com.velo.platform.strategies;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.configs.FareConfig;
import com.velo.platform.configs.PlatformConfig;
import com.velo.platform.strategies.impl.DriverMatchingHighestRatedDriverStrategy;
import com.velo.platform.strategies.impl.DriverMatchingNearestDriverStrategy;
import com.velo.platform.strategies.impl.RideFareSurgePricingFareCalculationStrategy;
import com.velo.platform.strategies.impl.RiderFareDefaultRideFareCalculationStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalTime;

@Component
@RequiredArgsConstructor
public class RideStrategyManager {

    private final DriverMatchingHighestRatedDriverStrategy highestRatedDriverStrategy;
    private final DriverMatchingNearestDriverStrategy nearestDriverStrategy;
    private final RideFareSurgePricingFareCalculationStrategy surgePricingFareCalculationStrategy;
    private final RiderFareDefaultRideFareCalculationStrategy defaultFareCalculationStrategy;
    private final PlatformConfig platformConfig;
    private final FareConfig fareConfig;

    public DriverMatchingStrategy driverMatchingStrategy(double riderRating) {
        if(riderRating >= platformConfig.getDriverRatingThreshold()) {
            return highestRatedDriverStrategy;
        } else {
            return nearestDriverStrategy;
        }
    }

    public RideFareCalculationStrategy rideFareCalculationStrategy() {
        LocalTime surgeStartTime = LocalTime.of((int) fareConfig.getSurgeStartHour(), 0);
        LocalTime surgeEndTime = LocalTime.of((int) fareConfig.getSurgeEndHour(), 0);
        LocalTime currentTime = UtcTimes.timeOfDay();

        boolean isSurgeTime = currentTime.isAfter(surgeStartTime) && currentTime.isBefore(surgeEndTime);

        if(isSurgeTime) {
            return surgePricingFareCalculationStrategy;
        } else {
            return defaultFareCalculationStrategy;
        }
    }

}