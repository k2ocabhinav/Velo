package com.velo.platform.events;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.services.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private final NotificationService notificationService;

    @EventListener
    public void handleRideRequested(RideRequestedEvent event) {
        Rider rider = event.getRideRequest().getRider();
        if (event.isScheduledDispatch()) {
            notificationService.createNotification(
                    rider.getUser(),
                    "Scheduled Ride Dispatch Started",
                    "Your scheduled ride is now being offered to nearby drivers.",
                    NotificationType.RIDE_DISPATCHED,
                    event.getRideRequest().getId()
            );

            for (Driver driver : event.getMatchedDrivers()) {
                notificationService.createNotification(
                        driver.getUser(),
                        "Scheduled Ride Available",
                        "A scheduled ride is ready for pickup consideration.",
                        NotificationType.RIDE_DISPATCHED,
                        event.getRideRequest().getId()
                );
            }

            log.debug("Notifications created for scheduled dispatch: {}, matchedDrivers={}",
                    event.getRideRequest().getId(), event.getMatchedDrivers().size());
            return;
        }

        notificationService.createNotification(
                rider.getUser(),
                "Ride Requested",
                "Your ride request has been submitted. Finding drivers nearby...",
                NotificationType.RIDE_REQUESTED,
                event.getRideRequest().getId()
        );

        for (Driver driver : event.getMatchedDrivers()) {
            notificationService.createNotification(
                    driver.getUser(),
                    "New Ride Request",
                    "A nearby rider is waiting for pickup.",
                    NotificationType.RIDE_REQUESTED,
                    event.getRideRequest().getId()
            );
        }

        log.debug("Notifications created for ride request: {}, matchedDrivers={}",
                event.getRideRequest().getId(), event.getMatchedDrivers().size());
    }

    @EventListener
    public void handleRideAccepted(RideAcceptedEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getDriver();
        
        // Notify Rider
        notificationService.createNotification(
                rider.getUser(),
                "Driver Accepted",
                "Driver " + driver.getUser().getFirstName() + " has accepted your ride request.",
                NotificationType.RIDE_ACCEPTED,
                event.getRide().getId()
        );
        
        // Notify Driver
        notificationService.createNotification(
                driver.getUser(),
                "Ride Accepted",
                "You have successfully accepted the ride for " + rider.getUser().getFirstName(),
                NotificationType.RIDE_ACCEPTED,
                event.getRide().getId()
        );
        
        log.debug("Notifications created for ride accepted: {}", event.getRide().getId());
    }

    @EventListener
    public void handleRideStarted(RideStartedEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getRide().getDriver();
        
        // Notify Rider
        notificationService.createNotification(
                rider.getUser(),
                "Ride Started",
                "Your ride has started. Enjoy your trip!",
                NotificationType.RIDE_STARTED,
                event.getRide().getId()
        );
        
        // Notify Driver
        notificationService.createNotification(
                driver.getUser(),
                "Ride Started",
                "Ongoing ride with " + rider.getUser().getFirstName() + " has started.",
                NotificationType.RIDE_STARTED,
                event.getRide().getId()
        );
        
        log.debug("Notifications created for ride started: {}", event.getRide().getId());
    }

    @EventListener
    public void handleRideEnded(RideEndedEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getRide().getDriver();
        
        // Notify Rider
        notificationService.createNotification(
                rider.getUser(),
                "Ride Ended",
                "Your ride has ended. Thank you for traveling with us!",
                NotificationType.RIDE_ENDED,
                event.getRide().getId()
        );
        
        // Notify Driver
        notificationService.createNotification(
                driver.getUser(),
                "Ride Ended",
                "Ride with " + rider.getUser().getFirstName() + " has ended. Earnings will be credited shortly.",
                NotificationType.RIDE_ENDED,
                event.getRide().getId()
        );
        
        log.debug("Notifications created for ride ended: {}", event.getRide().getId());
    }

    @EventListener
    public void handleRideCancelled(RideCancelledEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getRide().getDriver();
        
        // Notify Rider
        notificationService.createNotification(
                rider.getUser(),
                "Ride Cancelled",
                "Your ride has been cancelled.",
                NotificationType.RIDE_CANCELLED,
                event.getRide().getId()
        );
        
        // Notify Driver (if assigned)
        if (driver != null) {
            notificationService.createNotification(
                    driver.getUser(),
                    "Ride Cancelled",
                    "The ride with " + rider.getUser().getFirstName() + " has been cancelled.",
                    NotificationType.RIDE_CANCELLED,
                    event.getRide().getId()
            );
        }
        
        log.debug("Notifications created for ride cancelled: {}", event.getRide().getId());
    }

    @EventListener
    public void handlePaymentProcessed(PaymentProcessedEvent event) {
        Rider rider = event.getPayment().getRide().getRider();
        Driver driver = event.getPayment().getRide().getDriver();
        
        // Notify Rider
        notificationService.createNotification(
                rider.getUser(),
                "Payment Processed",
                "Payment of $" + event.getPayment().getAmount() + " has been processed.",
                NotificationType.PAYMENT_PROCESSED,
                event.getPayment().getId()
        );
        
        // Notify Driver
        notificationService.createNotification(
                driver.getUser(),
                "Earnings Credited",
                "Earnings for ride " + event.getPayment().getRide().getId() + " have been credited to your account.",
                NotificationType.PAYMENT_PROCESSED,
                event.getPayment().getId()
        );
        
        log.debug("Notifications created for payment processed: {}", event.getPayment().getId());
    }

    @EventListener
    public void handleScheduledRideCreated(ScheduledRideCreatedEvent event) {
        Rider rider = event.getRideRequest().getRider();
        notificationService.createNotification(
                rider.getUser(),
                "Ride Scheduled",
                "Your ride has been scheduled for " + event.getRideRequest().getScheduledTime() + ".",
                NotificationType.RIDE_SCHEDULED,
                event.getRideRequest().getId()
        );

        log.debug("Notification created for scheduled ride: {}", event.getRideRequest().getId());
    }

    @EventListener
    public void handleScheduledRideRescheduled(ScheduledRideRescheduledEvent event) {
        Rider rider = event.getRideRequest().getRider();
        notificationService.createNotification(
                rider.getUser(),
                "Ride Rescheduled",
                "Your scheduled ride has been moved to " + event.getRideRequest().getScheduledTime() + ".",
                NotificationType.RIDE_RESCHEDULED,
                event.getRideRequest().getId()
        );

        log.debug("Notification created for rescheduled ride: {}", event.getRideRequest().getId());
    }

    @EventListener
    public void handleScheduledRideCancelled(ScheduledRideCancelledEvent event) {
        Rider rider = event.getRideRequest().getRider();
        notificationService.createNotification(
                rider.getUser(),
                "Scheduled Ride Cancelled",
                "Your scheduled ride has been cancelled.",
                NotificationType.RIDE_CANCELLED,
                event.getRideRequest().getId()
        );

        log.debug("Notification created for cancelled scheduled ride: {}", event.getRideRequest().getId());
    }
}
