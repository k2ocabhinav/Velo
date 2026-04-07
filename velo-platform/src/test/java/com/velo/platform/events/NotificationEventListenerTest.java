package com.velo.platform.events;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.services.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
class NotificationEventListenerTest {

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private NotificationEventListener notificationEventListener;

    private User riderUser;
    private User driverUserOne;
    private User driverUserTwo;
    private Rider rider;
    private Driver driverOne;
    private Driver driverTwo;
    private RideRequest rideRequest;

    @BeforeEach
    void setUp() {
        riderUser = User.builder().id(1L).firstName("Rita").build();
        driverUserOne = User.builder().id(2L).firstName("Dev").build();
        driverUserTwo = User.builder().id(3L).firstName("Sam").build();

        rider = Rider.builder().id(11L).user(riderUser).build();
        driverOne = Driver.builder().id(21L).user(driverUserOne).build();
        driverTwo = Driver.builder().id(22L).user(driverUserTwo).build();

        rideRequest = RideRequest.builder()
                .id(101L)
                .rider(rider)
                .scheduledTime(LocalDateTime.of(2026, 4, 8, 9, 30))
                .build();
    }

    @Test
    @DisplayName("Normal ride request should notify rider and matched drivers")
    void handleRideRequested_ShouldNotifyRiderAndMatchedDrivers() {
        RideRequestedEvent event = new RideRequestedEvent(this, rideRequest, List.of(driverOne, driverTwo), false);

        notificationEventListener.handleRideRequested(event);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<NotificationType> typeCaptor = ArgumentCaptor.forClass(NotificationType.class);
        verify(notificationService, times(3)).createNotification(
                userCaptor.capture(),
                titleCaptor.capture(),
                messageCaptor.capture(),
                typeCaptor.capture(),
                org.mockito.ArgumentMatchers.eq(101L)
        );

        assertThat(userCaptor.getAllValues()).containsExactly(riderUser, driverUserOne, driverUserTwo);
        assertThat(titleCaptor.getAllValues()).containsExactly("Ride Requested", "New Ride Request", "New Ride Request");
        assertThat(messageCaptor.getAllValues()).containsExactly(
                "Your ride request has been submitted. Finding drivers nearby...",
                "A nearby rider is waiting for pickup.",
                "A nearby rider is waiting for pickup."
        );
        assertThat(typeCaptor.getAllValues()).containsExactly(
                NotificationType.RIDE_REQUESTED,
                NotificationType.RIDE_REQUESTED,
                NotificationType.RIDE_REQUESTED
        );
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("Scheduled dispatch should notify rider and matched drivers with dispatch type")
    void handleRideRequested_ScheduledDispatch_ShouldUseDispatchNotifications() {
        RideRequestedEvent event = new RideRequestedEvent(this, rideRequest, List.of(driverOne), true);

        notificationEventListener.handleRideRequested(event);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<NotificationType> typeCaptor = ArgumentCaptor.forClass(NotificationType.class);
        verify(notificationService, times(2)).createNotification(
                userCaptor.capture(),
                titleCaptor.capture(),
                messageCaptor.capture(),
                typeCaptor.capture(),
                org.mockito.ArgumentMatchers.eq(101L)
        );

        assertThat(userCaptor.getAllValues()).containsExactly(riderUser, driverUserOne);
        assertThat(titleCaptor.getAllValues()).containsExactly("Scheduled Ride Dispatch Started", "Scheduled Ride Available");
        assertThat(messageCaptor.getAllValues()).containsExactly(
                "Your scheduled ride is now being offered to nearby drivers.",
                "A scheduled ride is ready for pickup consideration."
        );
        assertThat(typeCaptor.getAllValues()).containsExactly(
                NotificationType.RIDE_DISPATCHED,
                NotificationType.RIDE_DISPATCHED
        );
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("Scheduled ride created should notify rider")
    void handleScheduledRideCreated_ShouldNotifyRider() {
        notificationEventListener.handleScheduledRideCreated(new ScheduledRideCreatedEvent(this, rideRequest));

        verify(notificationService).createNotification(
                riderUser,
                "Ride Scheduled",
                "Your ride has been scheduled for 2026-04-08T09:30.",
                NotificationType.RIDE_SCHEDULED,
                101L
        );
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("Scheduled ride rescheduled should notify rider")
    void handleScheduledRideRescheduled_ShouldNotifyRider() {
        notificationEventListener.handleScheduledRideRescheduled(new ScheduledRideRescheduledEvent(this, rideRequest));

        verify(notificationService).createNotification(
                riderUser,
                "Ride Rescheduled",
                "Your scheduled ride has been moved to 2026-04-08T09:30.",
                NotificationType.RIDE_RESCHEDULED,
                101L
        );
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("Scheduled ride cancelled should notify rider")
    void handleScheduledRideCancelled_ShouldNotifyRider() {
        notificationEventListener.handleScheduledRideCancelled(new ScheduledRideCancelledEvent(this, rideRequest));

        verify(notificationService).createNotification(
                riderUser,
                "Scheduled Ride Cancelled",
                "Your scheduled ride has been cancelled.",
                NotificationType.RIDE_CANCELLED,
                101L
        );
        verifyNoMoreInteractions(notificationService);
    }
}
