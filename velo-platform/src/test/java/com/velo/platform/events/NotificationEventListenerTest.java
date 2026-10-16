package com.velo.platform.events;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideRealtimeService;
import com.velo.platform.services.TenantNotificationFormatter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class NotificationEventListenerTest {

    @Mock
    private NotificationService notificationService;

    @Mock
    private RideRealtimeService rideRealtimeService;

    @Mock
    private TenantNotificationFormatter tenantNotificationFormatter;

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
                .rideRequestStatus(RideRequestStatus.PENDING)
                .scheduledTime(LocalDateTime.of(2026, 4, 8, 9, 30))
                .build();
        when(tenantNotificationFormatter.forUser(any(User.class)))
                .thenReturn(TenantNotificationFormatter.NotificationCopy.defaults());
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
        assertThat(titleCaptor.getAllValues()).containsExactly("Trip Requested", "Trip Request Received", "Trip Request Received");
        assertThat(messageCaptor.getAllValues()).containsExactly(
                "Your trip request has been submitted. Finding drivers nearby...",
                "A nearby trip request is waiting for your response.",
                "A nearby trip request is waiting for your response."
        );
        assertThat(typeCaptor.getAllValues()).containsExactly(
                NotificationType.RIDE_REQUESTED,
                NotificationType.RIDE_REQUESTED,
                NotificationType.RIDE_REQUESTED
        );
        verify(rideRealtimeService).publishRideRequestPending(event.getRideRequest());
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
        assertThat(titleCaptor.getAllValues()).containsExactly("Scheduled Trip Dispatch Started", "Scheduled Trip Request Received");
        assertThat(messageCaptor.getAllValues()).containsExactly(
                "Your scheduled trip is now being offered to nearby drivers.",
                "A scheduled trip request is ready for your response."
        );
        assertThat(typeCaptor.getAllValues()).containsExactly(
                NotificationType.RIDE_DISPATCHED,
                NotificationType.RIDE_DISPATCHED
        );
        verify(rideRealtimeService).publishRideRequestPending(event.getRideRequest());
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("Ride status events should also publish realtime ride updates")
    void rideStatusEvents_ShouldPublishRealtimeUpdates() {
        Ride ride = Ride.builder()
                .id(500L)
                .rider(rider)
                .driver(driverOne)
                .rideStatus(RideStatus.CONFIRMED)
                .build();

        notificationEventListener.handleRideAccepted(new RideAcceptedEvent(this, ride, driverOne));
        verify(rideRealtimeService).publishRideStatus(ride, RideStatus.CONFIRMED);

        ride.setRideStatus(RideStatus.ONGOING);
        notificationEventListener.handleRideStarted(new RideStartedEvent(this, ride));
        verify(rideRealtimeService).publishRideStatus(ride, RideStatus.ONGOING);

        ride.setRideStatus(RideStatus.ENDED);
        notificationEventListener.handleRideEnded(new RideEndedEvent(this, ride));
        verify(rideRealtimeService).publishRideStatus(ride, RideStatus.ENDED);

        ride.setRideStatus(RideStatus.CANCELLED);
        notificationEventListener.handleRideCancelled(new RideCancelledEvent(this, ride));
        verify(rideRealtimeService).publishRideStatus(ride, RideStatus.CANCELLED);
    }

    @Test
    @DisplayName("Scheduled ride created should notify rider")
    void handleScheduledRideCreated_ShouldNotifyRider() {
        notificationEventListener.handleScheduledRideCreated(new ScheduledRideCreatedEvent(this, rideRequest));

        verify(notificationService).createNotification(
                riderUser,
                "Trip Scheduled",
                "Your trip has been scheduled for Wed 8 Apr, 09:30.",
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
                "Trip Rescheduled",
                "Your scheduled trip has been moved to Wed 8 Apr, 09:30.",
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
                "Scheduled Trip Cancelled",
                "Your scheduled trip has been cancelled.",
                NotificationType.RIDE_CANCELLED,
                101L
        );
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    void saffronNotificationsUseTenantLabelsCurrencyAndLocalHumanTime() {
        TenantNotificationFormatter.NotificationCopy saffron = new TenantNotificationFormatter.NotificationCopy(
                "Guest", "Chauffeur", "Transfer", "INR", ZoneId.of("Asia/Kolkata"));
        when(tenantNotificationFormatter.forUser(riderUser)).thenReturn(saffron);

        Ride ride = Ride.builder()
                .id(500L)
                .rider(rider)
                .driver(driverOne)
                .rideStatus(RideStatus.CONFIRMED)
                .build();
        notificationEventListener.handleRideAccepted(new RideAcceptedEvent(this, ride, driverOne));
        notificationEventListener.handleRideStarted(new RideStartedEvent(this, ride));
        notificationEventListener.handleRideEnded(new RideEndedEvent(this, ride));
        notificationEventListener.handleRideCancelled(new RideCancelledEvent(this, ride));
        notificationEventListener.handlePaymentProcessed(new PaymentProcessedEvent(this, Payment.builder()
                .id(777L)
                .amount(new BigDecimal("1511.19"))
                .ride(ride)
                .build()));

        rideRequest.setScheduledTime(LocalDateTime.of(2026, 10, 17, 0, 35));
        notificationEventListener.handleScheduledRideCreated(new ScheduledRideCreatedEvent(this, rideRequest));
        notificationEventListener.handleScheduledRideRescheduled(new ScheduledRideRescheduledEvent(this, rideRequest));
        notificationEventListener.handleScheduledRideCancelled(new ScheduledRideCancelledEvent(this, rideRequest));

        ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationService, times(13)).createNotification(
                any(User.class), titleCaptor.capture(), messageCaptor.capture(), any(NotificationType.class), any(Long.class));

        assertThat(titleCaptor.getAllValues()).containsExactly(
                "Chauffeur Accepted", "Transfer Accepted",
                "Transfer Started", "Transfer Started",
                "Transfer Ended", "Transfer Ended",
                "Transfer Cancelled", "Transfer Cancelled",
                "Payment Processed", "Earnings Credited",
                "Transfer Scheduled", "Transfer Rescheduled", "Scheduled Transfer Cancelled");
        assertThat(messageCaptor.getAllValues()).containsExactly(
                "Your transfer request was accepted by chauffeur Dev.",
                "You have successfully accepted the transfer for guest Rita.",
                "Your transfer has started. Enjoy your journey!",
                "Ongoing transfer with guest Rita has started.",
                "Your transfer has ended. Thank you for traveling with us!",
                "The transfer with guest Rita has ended. Earnings will be credited shortly.",
                "Your transfer has been cancelled.",
                "The transfer with guest Rita has been cancelled.",
                "Payment of ₹1,511.19 has been processed.",
                "Earnings for transfer 500 have been credited to your account.",
                "Your transfer has been scheduled for Sat 17 Oct, 06:05.",
                "Your scheduled transfer has been moved to Sat 17 Oct, 06:05.",
                "Your scheduled transfer has been cancelled.");
    }
}
