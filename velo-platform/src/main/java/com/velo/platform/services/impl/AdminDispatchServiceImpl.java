package com.velo.platform.services.impl;

import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.admin.AdminActiveRideDto;
import com.velo.platform.dto.admin.AdminDispatchAuditDto;
import com.velo.platform.dto.admin.AdminOpsHealthDto;
import com.velo.platform.dto.admin.AdminPendingRideRequestDto;
import com.velo.platform.dto.admin.AdminRideOfferDto;
import com.velo.platform.entities.AdminDispatchAudit;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.AdminDispatchActionType;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.RideOfferStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.events.RideAcceptedEvent;
import com.velo.platform.events.RideCancelledEvent;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.AdminDispatchAuditRepository;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideOfferRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.AdminDispatchService;
import com.velo.platform.services.CacheService;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideOfferService;
import com.velo.platform.services.RideRealtimeService;
import com.velo.platform.services.RideService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminDispatchServiceImpl implements AdminDispatchService {

    private final RideRequestRepository rideRequestRepository;
    private final RideRepository rideRepository;
    private final RideOfferRepository rideOfferRepository;
    private final DriverRepository driverRepository;
    private final RiderRepository riderRepository;
    private final AdminDispatchAuditRepository adminDispatchAuditRepository;
    private final RideService rideService;
    private final RideOfferService rideOfferService;
    private final NotificationService notificationService;
    private final RideRealtimeService rideRealtimeService;
    private final CacheService cacheService;
    private final ApplicationEventPublisher eventPublisher;
    private final ModelMapper modelMapper;

    @Override
    @Transactional(readOnly = true)
    public Page<AdminPendingRideRequestDto> getPendingRideRequests(Pageable pageable) {
        return rideRequestRepository.findByRideRequestStatusOrderByRequestedTimeDesc(RideRequestStatus.PENDING, pageable)
                .map(rideRequest -> AdminPendingRideRequestDto.builder()
                        .rideRequestId(rideRequest.getId())
                        .riderId(rideRequest.getRider() == null ? null : rideRequest.getRider().getId())
                        .riderName(resolveUserName(rideRequest.getRider() == null ? null : rideRequest.getRider().getUser()))
                        .status(rideRequest.getRideRequestStatus() == null ? null : rideRequest.getRideRequestStatus().name())
                        .fare(rideRequest.getFare())
                        .requestedTime(rideRequest.getRequestedTime())
                        .offeredDriverCount(rideOfferRepository.countByRideRequestIdAndStatus(rideRequest.getId(), RideOfferStatus.OFFERED))
                        .build());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminActiveRideDto> getActiveRides(Pageable pageable) {
        return rideRepository.findByRideStatusInOrderByCreatedTimeDesc(List.of(RideStatus.CONFIRMED, RideStatus.ONGOING), pageable)
                .map(ride -> AdminActiveRideDto.builder()
                        .rideId(ride.getId())
                        .riderId(ride.getRider() == null ? null : ride.getRider().getId())
                        .riderName(resolveUserName(ride.getRider() == null ? null : ride.getRider().getUser()))
                        .driverId(ride.getDriver() == null ? null : ride.getDriver().getId())
                        .driverName(resolveUserName(ride.getDriver() == null ? null : ride.getDriver().getUser()))
                        .status(ride.getRideStatus() == null ? null : ride.getRideStatus().name())
                        .fare(ride.getFare())
                        .createdTime(ride.getCreatedTime())
                        .startedAt(ride.getStartedAt())
                        .build());
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminRideOfferDto> getRideOffers(Long rideRequestId) {
        return rideOfferRepository.findByRideRequestIdOrderByOfferedAtDesc(rideRequestId)
                .stream()
                .map(offer -> AdminRideOfferDto.builder()
                        .offerId(offer.getId())
                        .driverId(offer.getDriver() == null ? null : offer.getDriver().getId())
                        .driverName(resolveUserName(offer.getDriver() == null ? null : offer.getDriver().getUser()))
                        .status(offer.getStatus() == null ? null : offer.getStatus().name())
                        .offeredAt(offer.getOfferedAt())
                        .expiresAt(offer.getExpiresAt())
                        .resolvedAt(offer.getResolvedAt())
                        .resolutionReason(offer.getResolutionReason())
                        .build())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminDispatchAuditDto> getDispatchAudit(Pageable pageable) {
        return adminDispatchAuditRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(audit -> AdminDispatchAuditDto.builder()
                        .id(audit.getId())
                        .actionType(audit.getActionType() == null ? null : audit.getActionType().name())
                        .actorUserId(audit.getActorUserId())
                        .rideRequestId(audit.getRideRequest() == null ? null : audit.getRideRequest().getId())
                        .rideId(audit.getRide() == null ? null : audit.getRide().getId())
                        .previousDriverId(audit.getPreviousDriver() == null ? null : audit.getPreviousDriver().getId())
                        .nextDriverId(audit.getNextDriver() == null ? null : audit.getNextDriver().getId())
                        .reason(audit.getReason())
                        .createdAt(audit.getCreatedAt())
                        .build());
    }

    @Override
    @Transactional
    public RideDto assignPendingRideRequest(Long rideRequestId, Long driverId, String reason) {
        RideRequest rideRequest = rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride request not found with id: " + rideRequestId));
        if (rideRequest.getRideRequestStatus() != RideRequestStatus.PENDING) {
            throw new RuntimeConflictException("Ride request is not pending and cannot be assigned.");
        }

        Driver newDriver = resolveAssignableDriver(driverId);
        newDriver.setAvailable(false);
        driverRepository.save(newDriver);

        Ride ride = rideService.createNewRide(rideRequest, newDriver);
        rideOfferService.findAcceptableOffer(rideRequestId, newDriver.getId())
                .ifPresent(rideOfferService::markAccepted);
        rideOfferService.revokeCompetingOffers(rideRequestId, newDriver.getId(), "Ride assigned by admin.");
        eventPublisher.publishEvent(new RideAcceptedEvent(this, ride, newDriver));
        writeAudit(AdminDispatchActionType.ASSIGN_REQUEST, reason, rideRequest, ride, null, newDriver);

        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
        return modelMapper.map(ride, RideDto.class);
    }

    @Override
    @Transactional
    public RideDto reassignRide(Long rideId, Long newDriverId, String reason) {
        Ride ride = rideService.getRideById(rideId);
        if (ride.getRideStatus() == RideStatus.CANCELLED || ride.getRideStatus() == RideStatus.ENDED) {
            throw new RuntimeConflictException("Only active rides can be reassigned.");
        }

        Driver previousDriver = ride.getDriver();
        Driver newDriver = resolveAssignableDriver(newDriverId);

        if (previousDriver != null && previousDriver.getId().equals(newDriver.getId())) {
            return modelMapper.map(ride, RideDto.class);
        }

        ride.setDriver(newDriver);
        Ride savedRide = rideRepository.save(ride);

        newDriver.setAvailable(false);
        driverRepository.save(newDriver);
        releaseDriverIfNoActiveRides(previousDriver, savedRide.getId());

        notifyRideReassignment(savedRide, previousDriver, newDriver);
        rideRealtimeService.publishRideStatus(savedRide, savedRide.getRideStatus());
        writeAudit(AdminDispatchActionType.REASSIGN_RIDE, reason, null, savedRide, previousDriver, newDriver);

        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
        return modelMapper.map(savedRide, RideDto.class);
    }

    @Override
    @Transactional
    public RideRequestDto forceCancelRideRequest(Long rideRequestId, String reason) {
        RideRequest rideRequest = rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride request not found with id: " + rideRequestId));

        if (rideRequest.getRideRequestStatus() == RideRequestStatus.CONFIRMED) {
            throw new RuntimeConflictException("Use ride cancellation for confirmed assignments.");
        }

        rideRequest.setRideRequestStatus(RideRequestStatus.CANCELLED);
        RideRequest savedRequest = rideRequestRepository.save(rideRequest);

        for (RideOffer offer : rideOfferRepository.findByRideRequestIdOrderByOfferedAtDesc(savedRequest.getId())) {
            if (offer.getStatus() == RideOfferStatus.OFFERED) {
                rideOfferService.markRevoked(offer, "Cancelled by admin.");
            }
        }

        if (savedRequest.getRider() != null && savedRequest.getRider().getUser() != null) {
            notificationService.createNotification(
                    savedRequest.getRider().getUser(),
                    "Ride request cancelled",
                    "An admin cancelled this ride request.",
                    NotificationType.RIDE_CANCELLED,
                    savedRequest.getId()
            );
            rideRealtimeService.publishRideRequestPending(savedRequest);
        }

        writeAudit(AdminDispatchActionType.FORCE_CANCEL_REQUEST, reason, savedRequest, null, null, null);
        cacheService.evictDashboardCache();
        return modelMapper.map(savedRequest, RideRequestDto.class);
    }

    @Override
    @Transactional
    public RideDto forceCancelRide(Long rideId, String reason) {
        Ride ride = rideService.getRideById(rideId);
        if (ride.getRideStatus() == RideStatus.CANCELLED || ride.getRideStatus() == RideStatus.ENDED) {
            return modelMapper.map(ride, RideDto.class);
        }

        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.CANCELLED);
        if (savedRide.getDriver() != null) {
            releaseDriverIfNoActiveRides(savedRide.getDriver(), savedRide.getId());
        }

        eventPublisher.publishEvent(new RideCancelledEvent(this, savedRide));
        writeAudit(AdminDispatchActionType.FORCE_CANCEL_RIDE, reason, null, savedRide, savedRide.getDriver(), null);
        cacheService.evictAvailableDriversCache();
        cacheService.evictDashboardCache();
        return modelMapper.map(savedRide, RideDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminOpsHealthDto getOpsHealth() {
        return AdminOpsHealthDto.builder()
                .redisAvailable(cacheService.isRedisAvailable())
                .cacheHits(cacheService.getCacheHitCount())
                .cacheMisses(cacheService.getCacheMissCount())
                .cacheErrors(cacheService.getCacheErrorCount())
                .totalRides(rideRepository.count())
                .totalDrivers(driverRepository.count())
                .totalRiders(riderRepository.count())
                .pendingRideRequests(rideRequestRepository.countByRideRequestStatus(RideRequestStatus.PENDING))
                .dispatchQueueDepth(rideOfferService.countOpenOffers())
                .expiredOfferCount(rideOfferService.countExpiredOffers())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private Driver resolveAssignableDriver(Long driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found with id: " + driverId));
        if (driver.getOnboardingStatus() != DriverOnboardingStatus.APPROVED) {
            throw new RuntimeConflictException("Driver is not approved for dispatch assignments.");
        }
        if (!Boolean.TRUE.equals(driver.getAvailable())) {
            throw new RuntimeConflictException("Driver is currently unavailable.");
        }
        return driver;
    }

    private void releaseDriverIfNoActiveRides(Driver driver, Long excludingRideId) {
        if (driver == null) {
            return;
        }

        boolean hasOtherActive = rideRepository.findByDriverAndRideStatusIn(driver, List.of(RideStatus.CONFIRMED, RideStatus.ONGOING))
                .stream()
                .anyMatch(activeRide -> excludingRideId == null || !activeRide.getId().equals(excludingRideId));

        if (!hasOtherActive) {
            driver.setAvailable(true);
            driverRepository.save(driver);
        }
    }

    private void notifyRideReassignment(Ride ride, Driver previousDriver, Driver newDriver) {
        if (ride.getRider() != null && ride.getRider().getUser() != null) {
            notificationService.createNotification(
                    ride.getRider().getUser(),
                    "Driver reassigned",
                    "Your ride has been reassigned by operations.",
                    NotificationType.RIDE_REASSIGNED,
                    ride.getId()
            );
        }

        if (previousDriver != null && previousDriver.getUser() != null) {
            notificationService.createNotification(
                    previousDriver.getUser(),
                    "Ride reassigned",
                    "Operations reassigned this ride to another driver.",
                    NotificationType.RIDE_REASSIGNED,
                    ride.getId()
            );
        }

        if (newDriver.getUser() != null) {
            notificationService.createNotification(
                    newDriver.getUser(),
                    "Ride assigned by operations",
                    "You were assigned to an active ride by admin operations.",
                    NotificationType.RIDE_REASSIGNED,
                    ride.getId()
            );
        }
    }

    private void writeAudit(
            AdminDispatchActionType actionType,
            String reason,
            RideRequest rideRequest,
            Ride ride,
            Driver previousDriver,
            Driver nextDriver
    ) {
        AdminDispatchAudit audit = AdminDispatchAudit.builder()
                .actionType(actionType)
                .actorUserId(resolveActorUserId())
                .rideRequest(rideRequest)
                .ride(ride)
                .previousDriver(previousDriver)
                .nextDriver(nextDriver)
                .reason(reason == null ? "No reason provided." : reason.trim())
                .build();
        adminDispatchAuditRepository.save(audit);
    }

    private Long resolveActorUserId() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            return -1L;
        }
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getUserId();
        }
        return -1L;
    }

    private String resolveUserName(User user) {
        if (user == null) {
            return "Unknown";
        }

        String fullName = (user.getFirstName() == null ? "" : user.getFirstName()) + " " +
                (user.getLastName() == null ? "" : user.getLastName());
        String normalized = fullName.trim();
        if (!normalized.isEmpty()) {
            return normalized;
        }
        return user.getEmail() == null ? "Unknown" : user.getEmail();
    }
}
