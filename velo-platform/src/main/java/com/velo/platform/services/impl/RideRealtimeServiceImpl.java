package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.dto.RideLocationDto;
import com.velo.platform.dto.RideUpdateEventDto;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.services.RideRealtimeService;
import com.velo.platform.utils.UserDestinations;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class RideRealtimeServiceImpl implements RideRealtimeService {

    private static final String RIDER_RIDE_UPDATES_DESTINATION = "/queue/ride-updates";

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void publishRideRequestPending(RideRequest rideRequest) {
        if (rideRequest == null || rideRequest.getRider() == null || rideRequest.getRider().getUser() == null) {
            return;
        }

        RideUpdateEventDto payload = new RideUpdateEventDto();
        payload.setEventType("RIDE_STATUS_CHANGED");
        payload.setRideRequestId(rideRequest.getId());
        payload.setStatus(rideRequest.getRideRequestStatus() == null ? "PENDING" : rideRequest.getRideRequestStatus().name());
        payload.setRiderId(rideRequest.getRider().getId());
        payload.setUpdatedAt(LocalDateTime.now());

        sendToUser(rideRequest.getRider().getUser(), payload);
    }

    @Override
    public void publishRideStatus(Ride ride, RideStatus rideStatus) {
        if (ride == null || ride.getRider() == null || ride.getRider().getUser() == null) {
            return;
        }

        RideUpdateEventDto payload = new RideUpdateEventDto();
        payload.setEventType(resolveStatusEventType(rideStatus));
        payload.setRideId(ride.getId());
        payload.setStatus(rideStatus == null ? null : rideStatus.name());
        payload.setRiderId(ride.getRider().getId());
        payload.setDriverId(ride.getDriver() == null ? null : ride.getDriver().getId());
        payload.setUpdatedAt(LocalDateTime.now());

        sendToUser(ride.getRider().getUser(), payload);
        if (ride.getDriver() != null && ride.getDriver().getUser() != null) {
            sendToUser(ride.getDriver().getUser(), payload);
        }
    }

    @Override
    public void publishDriverLocation(Ride ride, DriverLocationUpdateRequestDto locationUpdate) {
        if (ride == null || locationUpdate == null || ride.getRider() == null || ride.getRider().getUser() == null) {
            return;
        }

        RideLocationDto location = new RideLocationDto(
                locationUpdate.getLat(),
                locationUpdate.getLng(),
                locationUpdate.getHeading(),
                locationUpdate.getSpeedKph(),
                locationUpdate.getAccuracyM(),
                locationUpdate.getCapturedAt() == null ? LocalDateTime.now() : locationUpdate.getCapturedAt()
        );

        RideUpdateEventDto payload = new RideUpdateEventDto();
        payload.setEventType("DRIVER_LOCATION_UPDATED");
        payload.setRideId(ride.getId());
        payload.setStatus(ride.getRideStatus() == null ? null : ride.getRideStatus().name());
        payload.setRiderId(ride.getRider().getId());
        payload.setDriverId(ride.getDriver() == null ? null : ride.getDriver().getId());
        payload.setDriverLocation(location);
        payload.setUpdatedAt(LocalDateTime.now());

        sendToUser(ride.getRider().getUser(), payload);
    }

    private void sendToUser(User user, RideUpdateEventDto payload) {
        if (user == null) {
            return;
        }

        try {
            messagingTemplate.convertAndSendToUser(
                    UserDestinations.resolve(user),
                    RIDER_RIDE_UPDATES_DESTINATION,
                    payload
            );
        } catch (Exception exception) {
            log.error("Failed to publish ride update to user {}: {}", user.getId(), exception.getMessage());
        }
    }

    private String resolveStatusEventType(RideStatus rideStatus) {
        if (rideStatus == null) {
            return "RIDE_STATUS_CHANGED";
        }

        return switch (rideStatus) {
            case ENDED -> "RIDE_COMPLETED";
            case CANCELLED -> "RIDE_CANCELLED";
            default -> "RIDE_STATUS_CHANGED";
        };
    }
}
