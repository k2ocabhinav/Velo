package com.velo.platform.services;

import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.enums.RideStatus;

public interface RideRealtimeService {

    void publishRideRequestPending(RideRequest rideRequest);

    void publishRideStatus(Ride ride, RideStatus rideStatus);

    void publishDriverLocation(Ride ride, DriverLocationUpdateRequestDto locationUpdate);
}
