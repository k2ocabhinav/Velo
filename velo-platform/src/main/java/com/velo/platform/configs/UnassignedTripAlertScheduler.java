package com.velo.platform.configs;

import com.velo.platform.services.TripSheetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.scheduled-ride.unassigned-alert-enabled", havingValue = "true", matchIfMissing = true)
public class UnassignedTripAlertScheduler {
    private final TripSheetService tripSheetService;

    @Scheduled(fixedRateString = "${app.scheduled-ride.unassigned-alert-interval-ms:60000}")
    public void alertUnassignedTrips() {
        int created = tripSheetService.createUnassignedTripAlerts();
        if (created > 0) log.info("Unassigned scheduled trip alerts created: {}", created);
    }
}
