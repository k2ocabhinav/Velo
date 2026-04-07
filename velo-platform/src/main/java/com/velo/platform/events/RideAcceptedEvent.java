package com.velo.platform.events;

import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Driver;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class RideAcceptedEvent extends ApplicationEvent {

    private final Ride ride;
    private final Driver driver;

    public RideAcceptedEvent(Object source, Ride ride, Driver driver) {
        super(source);
        this.ride = ride;
        this.driver = driver;
    }
}
