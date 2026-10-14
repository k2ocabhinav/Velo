package com.velo.platform.configs;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.scheduled-ride")
public class ScheduledRideConfig {
    private int minAdvanceMinutes = 30;
    private int maxAdvanceDays = 7;
    private int dispatchWindowMinutes = 15;
    private int recurringMaterializationHorizonDays = 7;
    private long recurringMaterializationIntervalMs = 300000;
    private int unassignedAlertWindowMinutes = 60;
    private long unassignedAlertIntervalMs = 60000;
}
