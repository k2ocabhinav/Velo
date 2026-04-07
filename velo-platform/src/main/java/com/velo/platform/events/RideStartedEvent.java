package com.velo.platform.events;

import com.velo.platform.entities.Ride;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class RideStartedEvent extends ApplicationEvent {

    private final Ride ride;

    public RideStartedEvent(Object source, Ride ride) {
        super(source);
        this.ride = ride;
    }
}
