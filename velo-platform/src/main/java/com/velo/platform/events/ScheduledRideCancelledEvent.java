package com.velo.platform.events;

import com.velo.platform.entities.RideRequest;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class ScheduledRideCancelledEvent extends ApplicationEvent {

    private final RideRequest rideRequest;

    public ScheduledRideCancelledEvent(Object source, RideRequest rideRequest) {
        super(source);
        this.rideRequest = rideRequest;
    }
}
