package com.velo.platform.events;

import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Driver;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.util.List;

@Getter
public class RideRequestedEvent extends ApplicationEvent {

    private final RideRequest rideRequest;
    private final List<Driver> matchedDrivers;
    private final boolean scheduledDispatch;

    public RideRequestedEvent(Object source, RideRequest rideRequest, List<Driver> matchedDrivers, boolean scheduledDispatch) {
        super(source);
        this.rideRequest = rideRequest;
        this.matchedDrivers = matchedDrivers == null ? List.of() : List.copyOf(matchedDrivers);
        this.scheduledDispatch = scheduledDispatch;
    }
}
