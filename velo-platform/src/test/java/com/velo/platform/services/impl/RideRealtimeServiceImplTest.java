package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.dto.RideUpdateEventDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RideRealtimeServiceImplTest {

    private static final String RIDE_UPDATES_DESTINATION = "/queue/ride-updates";

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Ride status updates should publish typed status event to the rider and driver email destinations")
    void publishRideStatus_ShouldPublishToRiderAndDriver() {
        RideRealtimeServiceImpl service = new RideRealtimeServiceImpl(messagingTemplate);
        User riderUser = User.builder().id(11L).email("rider@test.com").build();
        User driverUser = User.builder().id(22L).email("driver@test.com").build();
        Rider rider = Rider.builder().id(101L).user(riderUser).build();
        Driver driver = Driver.builder().id(202L).user(driverUser).build();
        Ride ride = Ride.builder()
                .id(303L)
                .rider(rider)
                .driver(driver)
                .rideStatus(RideStatus.ENDED)
                .build();

        service.publishRideStatus(ride, RideStatus.ENDED);

        ArgumentCaptor<RideUpdateEventDto> payloadCaptor = ArgumentCaptor.forClass(RideUpdateEventDto.class);
        verify(messagingTemplate).convertAndSendToUser(
                org.mockito.ArgumentMatchers.eq("rider@test.com"),
                org.mockito.ArgumentMatchers.eq(RIDE_UPDATES_DESTINATION),
                payloadCaptor.capture()
        );
        verify(messagingTemplate).convertAndSendToUser(
                org.mockito.ArgumentMatchers.eq("driver@test.com"),
                org.mockito.ArgumentMatchers.eq(RIDE_UPDATES_DESTINATION),
                payloadCaptor.capture()
        );

        List<RideUpdateEventDto> payloads = payloadCaptor.getAllValues();
        assertThat(payloads).hasSize(2);
        assertThat(payloads).allSatisfy(payload -> {
            assertThat(payload.getEventType()).isEqualTo("RIDE_COMPLETED");
            assertThat(payload.getRideId()).isEqualTo(303L);
            assertThat(payload.getStatus()).isEqualTo("ENDED");
            assertThat(payload.getRiderId()).isEqualTo(101L);
            assertThat(payload.getDriverId()).isEqualTo(202L);
        });
    }

    @Test
    @DisplayName("Driver location updates should publish location payload to the rider email destination")
    void publishDriverLocation_ShouldPublishLocationPayload() {
        RideRealtimeServiceImpl service = new RideRealtimeServiceImpl(messagingTemplate);
        User riderUser = User.builder().id(11L).email("rider@test.com").build();
        Rider rider = Rider.builder().id(101L).user(riderUser).build();
        Driver driver = Driver.builder().id(202L).build();
        Ride ride = Ride.builder()
                .id(303L)
                .rider(rider)
                .driver(driver)
                .rideStatus(RideStatus.ONGOING)
                .build();
        DriverLocationUpdateRequestDto location = new DriverLocationUpdateRequestDto(
                12.9716,
                77.5946,
                120.0,
                30.0,
                8.0,
                LocalDateTime.now()
        );

        service.publishDriverLocation(ride, location);

        ArgumentCaptor<RideUpdateEventDto> payloadCaptor = ArgumentCaptor.forClass(RideUpdateEventDto.class);
        verify(messagingTemplate).convertAndSendToUser(
                org.mockito.ArgumentMatchers.eq("rider@test.com"),
                org.mockito.ArgumentMatchers.eq(RIDE_UPDATES_DESTINATION),
                payloadCaptor.capture()
        );
        verify(messagingTemplate, never()).convertAndSendToUser(
                org.mockito.ArgumentMatchers.eq("11"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any()
        );

        RideUpdateEventDto payload = payloadCaptor.getValue();
        assertThat(payload.getEventType()).isEqualTo("DRIVER_LOCATION_UPDATED");
        assertThat(payload.getRideId()).isEqualTo(303L);
        assertThat(payload.getStatus()).isEqualTo("ONGOING");
        assertThat(payload.getDriverLocation()).isNotNull();
        assertThat(payload.getDriverLocation().getLat()).isEqualTo(12.9716);
        assertThat(payload.getDriverLocation().getLng()).isEqualTo(77.5946);
    }

    @Test
    @DisplayName("Pending ride requests should publish rider status event to the rider email destination")
    void publishRideRequestPending_ShouldPublishPendingStatus() {
        RideRealtimeServiceImpl service = new RideRealtimeServiceImpl(messagingTemplate);
        User riderUser = User.builder().id(11L).email("rider@test.com").build();
        Rider rider = Rider.builder().id(101L).user(riderUser).build();
        RideRequest request = RideRequest.builder()
                .id(555L)
                .rider(rider)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .build();

        service.publishRideRequestPending(request);

        ArgumentCaptor<RideUpdateEventDto> payloadCaptor = ArgumentCaptor.forClass(RideUpdateEventDto.class);
        verify(messagingTemplate).convertAndSendToUser(
                org.mockito.ArgumentMatchers.eq("rider@test.com"),
                org.mockito.ArgumentMatchers.eq(RIDE_UPDATES_DESTINATION),
                payloadCaptor.capture()
        );

        RideUpdateEventDto payload = payloadCaptor.getValue();
        assertThat(payload.getEventType()).isEqualTo("RIDE_STATUS_CHANGED");
        assertThat(payload.getRideRequestId()).isEqualTo(555L);
        assertThat(payload.getStatus()).isEqualTo("PENDING");
        assertThat(payload.getRiderId()).isEqualTo(101L);
    }
}
