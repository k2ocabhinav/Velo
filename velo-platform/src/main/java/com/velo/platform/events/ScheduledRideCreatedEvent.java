package com.velo.platform.events;

import com.velo.platform.entities.RideRequest;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class ScheduledRideCreatedEvent extends ApplicationEvent {

    private final RideRequest rideRequest;

    public ScheduledRideCreatedEvent(Object source, RideRequest rideRequest) {
        super(source);
        this.rideRequest = rideRequest;
    }
}
