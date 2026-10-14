package com.velo.platform.configs;

import com.velo.platform.services.RecurringTripTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.scheduled-ride.recurring-materialization-enabled", havingValue = "true", matchIfMissing = true)
public class RecurringTripMaterializationScheduler {
    private final RecurringTripTemplateService templateService;

    @Scheduled(fixedRateString = "${app.scheduled-ride.recurring-materialization-interval-ms:300000}")
    public void materializeRecurringTrips() {
        int created = templateService.materializeOccurrences();
        if (created > 0) log.info("Recurring scheduled trips materialized: {}", created);
    }
}
