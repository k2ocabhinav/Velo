package com.velo.platform.events;

import com.velo.platform.entities.RideRequest;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class ScheduledRideRescheduledEvent extends ApplicationEvent {

    private final RideRequest rideRequest;

    public ScheduledRideRescheduledEvent(Object source, RideRequest rideRequest) {
        super(source);
        this.rideRequest = rideRequest;
    }
}
