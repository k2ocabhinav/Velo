package com.velo.platform.events;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideRealtimeService;
import com.velo.platform.services.TenantNotificationFormatter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final RideRealtimeService rideRealtimeService;
    private final TenantNotificationFormatter tenantNotificationFormatter;

    @EventListener
    public void handleRideRequested(RideRequestedEvent event) {
        Rider rider = event.getRideRequest().getRider();
        TenantNotificationFormatter.NotificationCopy copy = copyFor(rider, event.getMatchedDrivers());
        if (event.isScheduledDispatch()) {
            if (rider != null && rider.getUser() != null) {
                notificationService.createNotification(
                        rider.getUser(),
                        "Scheduled " + copy.tripLabelTitleCase() + " Dispatch Started",
                        "Your scheduled " + copy.tripLabelLowercase()
                                + " is now being offered to nearby " + copy.pluralDriverLabelLowercase() + ".",
                        NotificationType.RIDE_DISPATCHED,
                        event.getRideRequest().getId()
                );
            }

            for (Driver driver : event.getMatchedDrivers()) {
                notificationService.createNotification(
                        driver.getUser(),
                        "Scheduled " + copy.tripLabelTitleCase() + " Request Received",
                        "A scheduled " + copy.tripLabelLowercase() + " request is ready for your response.",
                        NotificationType.RIDE_DISPATCHED,
                        event.getRideRequest().getId()
                );
            }

            log.debug("Notifications created for scheduled dispatch: {}, matchedDrivers={}",
                    event.getRideRequest().getId(), event.getMatchedDrivers().size());
            if (rider != null && rider.getUser() != null) {
                rideRealtimeService.publishRideRequestPending(event.getRideRequest());
            }
            return;
        }

        if (rider != null && rider.getUser() != null) {
            notificationService.createNotification(
                    rider.getUser(),
                    copy.tripLabelTitleCase() + " Requested",
                    "Your " + copy.tripLabelLowercase()
                            + " request has been submitted. Finding " + copy.pluralDriverLabelLowercase() + " nearby...",
                    NotificationType.RIDE_REQUESTED,
                    event.getRideRequest().getId()
            );
        }

        for (Driver driver : event.getMatchedDrivers()) {
            notificationService.createNotification(
                    driver.getUser(),
                    copy.tripLabelTitleCase() + " Request Received",
                    "A nearby " + copy.tripLabelLowercase() + " request is waiting for your response.",
                    NotificationType.RIDE_REQUESTED,
                    event.getRideRequest().getId()
            );
        }

        log.debug("Notifications created for ride request: {}, matchedDrivers={}",
                event.getRideRequest().getId(), event.getMatchedDrivers().size());
        if (rider != null && rider.getUser() != null) {
            rideRealtimeService.publishRideRequestPending(event.getRideRequest());
        }
    }

    @EventListener
    public void handleRideAccepted(RideAcceptedEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getDriver();
        TenantNotificationFormatter.NotificationCopy copy = copyFor(rider, driver);

        if (rider != null && rider.getUser() != null && driver != null && driver.getUser() != null) {
            notificationService.createNotification(
                    rider.getUser(),
                    copy.driverLabelTitleCase() + " Accepted",
                    "Your " + copy.tripLabelLowercase() + " request was accepted by "
                            + copy.driverLabelLowercase() + " " + driver.getUser().getFirstName() + ".",
                    NotificationType.RIDE_ACCEPTED,
                    event.getRide().getId()
            );
        }

        if (driver != null && driver.getUser() != null) {
            notificationService.createNotification(
                    driver.getUser(),
                    copy.tripLabelTitleCase() + " Accepted",
                    "You have successfully accepted the " + copy.tripLabelLowercase() + " for "
                            + riderDescription(rider, copy) + ".",
                    NotificationType.RIDE_ACCEPTED,
                    event.getRide().getId()
            );
        }

        log.debug("Notifications created for ride accepted: {}", event.getRide().getId());
        rideRealtimeService.publishRideStatus(event.getRide(), event.getRide().getRideStatus());
    }

    @EventListener
    public void handleRideStarted(RideStartedEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getRide().getDriver();
        TenantNotificationFormatter.NotificationCopy copy = copyFor(rider, driver);

        if (rider != null && rider.getUser() != null) {
            notificationService.createNotification(
                    rider.getUser(),
                    copy.tripLabelTitleCase() + " Started",
                    "Your " + copy.tripLabelLowercase() + " has started. Enjoy your journey!",
                    NotificationType.RIDE_STARTED,
                    event.getRide().getId()
            );
        }

        if (driver != null && driver.getUser() != null) {
            notificationService.createNotification(
                    driver.getUser(),
                    copy.tripLabelTitleCase() + " Started",
                    "Ongoing " + copy.tripLabelLowercase() + " with " + riderDescription(rider, copy)
                            + " has started.",
                    NotificationType.RIDE_STARTED,
                    event.getRide().getId()
            );
        }

        log.debug("Notifications created for ride started: {}", event.getRide().getId());
        rideRealtimeService.publishRideStatus(event.getRide(), event.getRide().getRideStatus());
    }

    @EventListener
    public void handleRideEnded(RideEndedEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getRide().getDriver();
        TenantNotificationFormatter.NotificationCopy copy = copyFor(rider, driver);

        if (rider != null && rider.getUser() != null) {
            notificationService.createNotification(
                    rider.getUser(),
                    copy.tripLabelTitleCase() + " Ended",
                    "Your " + copy.tripLabelLowercase() + " has ended. Thank you for traveling with us!",
                    NotificationType.RIDE_ENDED,
                    event.getRide().getId()
            );
        }

        if (driver != null && driver.getUser() != null) {
            notificationService.createNotification(
                    driver.getUser(),
                    copy.tripLabelTitleCase() + " Ended",
                    "The " + copy.tripLabelLowercase() + " with " + riderDescription(rider, copy)
                            + " has ended. Earnings will be credited shortly.",
                    NotificationType.RIDE_ENDED,
                    event.getRide().getId()
            );
        }

        log.debug("Notifications created for ride ended: {}", event.getRide().getId());
        rideRealtimeService.publishRideStatus(event.getRide(), event.getRide().getRideStatus());
    }

    @EventListener
    public void handleRideCancelled(RideCancelledEvent event) {
        Rider rider = event.getRide().getRider();
        Driver driver = event.getRide().getDriver();
        TenantNotificationFormatter.NotificationCopy copy = copyFor(rider, driver);

        if (rider != null && rider.getUser() != null) {
            notificationService.createNotification(
                    rider.getUser(),
                    copy.tripLabelTitleCase() + " Cancelled",
                    "Your " + copy.tripLabelLowercase() + " has been cancelled.",
                    NotificationType.RIDE_CANCELLED,
                    event.getRide().getId()
            );
        }

        if (driver != null && driver.getUser() != null) {
            notificationService.createNotification(
                    driver.getUser(),
                    copy.tripLabelTitleCase() + " Cancelled",
                    "The " + copy.tripLabelLowercase() + " with " + riderDescription(rider, copy)
                            + " has been cancelled.",
                    NotificationType.RIDE_CANCELLED,
                    event.getRide().getId()
            );
        }

        log.debug("Notifications created for ride cancelled: {}", event.getRide().getId());
        rideRealtimeService.publishRideStatus(event.getRide(), event.getRide().getRideStatus());
    }

    @EventListener
    public void handlePaymentProcessed(PaymentProcessedEvent event) {
        Rider rider = event.getPayment().getRide() == null ? null : event.getPayment().getRide().getRider();
        Driver driver = event.getPayment().getRide() == null ? null : event.getPayment().getRide().getDriver();
        User tenantUser = rider != null && rider.getUser() != null
                ? rider.getUser()
                : driver != null ? driver.getUser() : event.getPayment().getUser();
        TenantNotificationFormatter.NotificationCopy copy = tenantNotificationFormatter.forUser(tenantUser);

        if (rider != null && rider.getUser() != null) {
            notificationService.createNotification(
                    rider.getUser(),
                    "Payment Processed",
                    "Payment of " + copy.formatMoney(event.getPayment().getAmount()) + " has been processed.",
                    NotificationType.PAYMENT_PROCESSED,
                    event.getPayment().getId()
            );
        }

        if (driver != null && driver.getUser() != null && event.getPayment().getRide() != null) {
            notificationService.createNotification(
                    driver.getUser(),
                    "Earnings Credited",
                    "Earnings for " + copy.tripLabelLowercase() + " " + event.getPayment().getRide().getId()
                            + " have been credited to your account.",
                    NotificationType.PAYMENT_PROCESSED,
                    event.getPayment().getId()
            );
        }

        log.debug("Notifications created for payment processed: {}", event.getPayment().getId());
    }

    @EventListener
    public void handleScheduledRideCreated(ScheduledRideCreatedEvent event) {
        Rider rider = event.getRideRequest().getRider();
        if (rider == null || rider.getUser() == null) {
            return;
        }
        TenantNotificationFormatter.NotificationCopy copy = tenantNotificationFormatter.forUser(rider.getUser());
        notificationService.createNotification(
                rider.getUser(),
                copy.tripLabelTitleCase() + " Scheduled",
                "Your " + copy.tripLabelLowercase() + " has been scheduled for "
                        + copy.formatScheduledTime(event.getRideRequest().getScheduledTime()) + ".",
                NotificationType.RIDE_SCHEDULED,
                event.getRideRequest().getId()
        );

        log.debug("Notification created for scheduled ride: {}", event.getRideRequest().getId());
    }

    @EventListener
    public void handleScheduledRideRescheduled(ScheduledRideRescheduledEvent event) {
        Rider rider = event.getRideRequest().getRider();
        if (rider == null || rider.getUser() == null) {
            return;
        }
        TenantNotificationFormatter.NotificationCopy copy = tenantNotificationFormatter.forUser(rider.getUser());
        notificationService.createNotification(
                rider.getUser(),
                copy.tripLabelTitleCase() + " Rescheduled",
                "Your scheduled " + copy.tripLabelLowercase() + " has been moved to "
                        + copy.formatScheduledTime(event.getRideRequest().getScheduledTime()) + ".",
                NotificationType.RIDE_RESCHEDULED,
                event.getRideRequest().getId()
        );

        log.debug("Notification created for rescheduled ride: {}", event.getRideRequest().getId());
    }

    @EventListener
    public void handleScheduledRideCancelled(ScheduledRideCancelledEvent event) {
        Rider rider = event.getRideRequest().getRider();
        if (rider == null || rider.getUser() == null) {
            return;
        }
        TenantNotificationFormatter.NotificationCopy copy = tenantNotificationFormatter.forUser(rider.getUser());
        notificationService.createNotification(
                rider.getUser(),
                "Scheduled " + copy.tripLabelTitleCase() + " Cancelled",
                "Your scheduled " + copy.tripLabelLowercase() + " has been cancelled.",
                NotificationType.RIDE_CANCELLED,
                event.getRideRequest().getId()
        );

        log.debug("Notification created for cancelled scheduled ride: {}", event.getRideRequest().getId());
    }

    private TenantNotificationFormatter.NotificationCopy copyFor(Rider rider, Iterable<Driver> drivers) {
        if (rider != null && rider.getUser() != null) {
            return tenantNotificationFormatter.forUser(rider.getUser());
        }
        for (Driver driver : drivers) {
            if (driver.getUser() != null) return tenantNotificationFormatter.forUser(driver.getUser());
        }
        return TenantNotificationFormatter.NotificationCopy.defaults();
    }

    private TenantNotificationFormatter.NotificationCopy copyFor(Rider rider, Driver driver) {
        if (rider != null && rider.getUser() != null) {
            return tenantNotificationFormatter.forUser(rider.getUser());
        }
        return tenantNotificationFormatter.forUser(driver == null ? null : driver.getUser());
    }

    private String riderDescription(Rider rider, TenantNotificationFormatter.NotificationCopy copy) {
        if (rider == null || rider.getUser() == null) return "dispatch request";
        return copy.riderLabelLowercase() + " " + rider.getUser().getFirstName();
    }
}
