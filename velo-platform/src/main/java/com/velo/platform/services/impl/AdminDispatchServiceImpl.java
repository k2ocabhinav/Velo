package com.velo.platform.services.impl;

import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.dto.admin.AdminCreateDispatchRequestDto;
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
import com.velo.platform.services.TenantScopeService;
import com.velo.platform.strategies.RideStrategyManager;
import com.velo.platform.utils.GeometryUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.locationtech.jts.geom.Point;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminDispatchServiceImpl implements AdminDispatchService {

    private static final long DRIVER_OFFER_TTL_SECONDS = 45L;

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
    private final TenantScopeService tenantScopeService;
    private final RideStrategyManager rideStrategyManager;

    @Override
    @Transactional
    public RideRequestDto createDispatchRequest(AdminCreateDispatchRequestDto requestDto) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();

        RideRequest rideRequest = RideRequest.builder()
                .tenantId(tenantId)
                .pickupLocation(GeometryUtil.createPoint(requestDto.getPickupLocation()))
                .dropOffLocation(GeometryUtil.createPoint(requestDto.getDropOffLocation()))
                .paymentMethod(requestDto.getPaymentMethod())
                .rideRequestStatus(RideRequestStatus.PENDING)
                .customerName(normalizeString(requestDto.getCustomerName()))
                .customerPhone(normalizeString(requestDto.getCustomerPhone()))
                .pickupAddress(normalizeString(requestDto.getPickupAddress()))
                .dropOffAddress(normalizeString(requestDto.getDropOffAddress()))
                .externalReference(normalizeString(requestDto.getExternalReference()))
                .build();
        rideRequest.setFare(rideStrategyManager.rideFareCalculationStrategy().calculateFare(rideRequest));

        RideRequest savedRequest = rideRequestRepository.save(rideRequest);

        List<Driver> matchedDrivers = rideStrategyManager
                .driverMatchingStrategy(0.0)
                .findMatchingDrivers(savedRequest);

        rideOfferService.createOffers(savedRequest, matchedDrivers, DRIVER_OFFER_TTL_SECONDS);
        if (matchedDrivers.isEmpty()) {
            savedRequest.setRideRequestStatus(RideRequestStatus.EXPIRED);
            savedRequest = rideRequestRepository.save(savedRequest);
        } else {
            for (Driver matchedDriver : matchedDrivers) {
                if (matchedDriver.getUser() == null) {
                    continue;
                }
                notificationService.createNotification(
                        matchedDriver.getUser(),
                        "New dispatch request",
                        "A new dispatch request is available near your location.",
                        NotificationType.RIDE_REQUESTED,
                        savedRequest.getId()
                );
            }
        }

        writeAudit(
                AdminDispatchActionType.CREATE_REQUEST,
                "Dispatch request created from admin console.",
                savedRequest,
                null,
                null,
                null
        );

        cacheService.evictDashboardCache();
        return modelMapper.map(savedRequest, RideRequestDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminPendingRideRequestDto> getPendingRideRequests(Pageable pageable) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Page<RideRequest> pendingRequests = rideRequestRepository
                .findByTenantIdAndRideRequestStatusOrderByRequestedTimeDesc(tenantId, RideRequestStatus.PENDING, pageable);
        List<Long> requestIds = pendingRequests.getContent().stream().map(RideRequest::getId).toList();
        Map<Long, Long> offeredCounts = requestIds.isEmpty()
                ? Map.of()
                : rideOfferRepository.countOffersByRideRequestIdsAndStatus(requestIds, RideOfferStatus.OFFERED).stream()
                        .collect(Collectors.toMap(
                                RideOfferRepository.OfferCountProjection::getRideRequestId,
                                RideOfferRepository.OfferCountProjection::getOfferCount
                        ));

        return pendingRequests
                .map(rideRequest -> AdminPendingRideRequestDto.builder()
                        .rideRequestId(rideRequest.getId())
                        .riderId(rideRequest.getRider() == null ? null : rideRequest.getRider().getId())
                        .riderName(resolveUserName(rideRequest.getRider() == null ? null : rideRequest.getRider().getUser()))
                        .customerName(rideRequest.getCustomerName())
                        .customerPhone(rideRequest.getCustomerPhone())
                        .pickupAddress(rideRequest.getPickupAddress())
                        .dropOffAddress(rideRequest.getDropOffAddress())
                        .externalReference(rideRequest.getExternalReference())
                        .status(rideRequest.getRideRequestStatus() == null ? null : rideRequest.getRideRequestStatus().name())
                        .fare(rideRequest.getFare())
                        .requestedTime(rideRequest.getRequestedTime())
                        .offeredDriverCount(offeredCounts.getOrDefault(rideRequest.getId(), 0L))
                        .build());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminActiveRideDto> getActiveRides(Pageable pageable) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        return rideRepository
                .findByTenantIdAndRideStatusInOrderByCreatedTimeDesc(tenantId, List.of(RideStatus.CONFIRMED, RideStatus.ONGOING), pageable)
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
    public List<GeocodingResultDto> getRecentAddresses() {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Map<String, GeocodingResultDto> recentAddresses = new LinkedHashMap<>();
        for (Ride ride : rideRepository.findTop20ByTenantIdOrderByCreatedTimeDesc(tenantId)) {
            addRecentAddress(recentAddresses, ride.getPickupLocation(), "Recent pickup");
            addRecentAddress(recentAddresses, ride.getDropOffLocation(), "Recent drop-off");
        }
        return List.copyOf(recentAddresses.values());
    }

    private void addRecentAddress(Map<String, GeocodingResultDto> addresses, Point point, String type) {
        if (point == null) return;
        double latitude = point.getY();
        double longitude = point.getX();
        String key = String.format(Locale.ROOT, "%.5f,%.5f", latitude, longitude);
        addresses.putIfAbsent(key, new GeocodingResultDto(key, latitude, longitude, type));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminRideOfferDto> getRideOffers(Long rideRequestId) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        return rideOfferRepository.findByRideRequestIdAndTenantIdOrderByOfferedAtDesc(rideRequestId, tenantId)
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
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        return adminDispatchAuditRepository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable)
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
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RideRequest rideRequest = rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride request not found with id: " + rideRequestId));
        if (!tenantId.equals(rideRequest.getTenantId())) {
            throw new RuntimeConflictException("Cross-tenant ride request access is not allowed.");
        }
        if (rideRequest.getRideRequestStatus() != RideRequestStatus.PENDING) {
            throw new RuntimeConflictException("Ride request is not pending and cannot be assigned.");
        }

        Driver newDriver = resolveAssignableDriver(driverId);
        int claimed = rideRequestRepository.compareAndSetStatus(
                rideRequestId,
                tenantId,
                RideRequestStatus.PENDING,
                RideRequestStatus.CONFIRMED
        );
        if (claimed == 0) {
            throw new RuntimeConflictException("This ride has already been assigned.");
        }
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
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Ride ride = rideService.getRideById(rideId);
        if (!tenantId.equals(ride.getTenantId())) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }
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
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RideRequest rideRequest = rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride request not found with id: " + rideRequestId));
        if (!tenantId.equals(rideRequest.getTenantId())) {
            throw new RuntimeConflictException("Cross-tenant ride request access is not allowed.");
        }

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
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Ride ride = rideService.getRideById(rideId);
        if (!tenantId.equals(ride.getTenantId())) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }
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
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        return AdminOpsHealthDto.builder()
                .redisAvailable(cacheService.isRedisAvailable())
                .cacheHits(cacheService.getCacheHitCount())
                .cacheMisses(cacheService.getCacheMissCount())
                .cacheErrors(cacheService.getCacheErrorCount())
                .totalRides(rideRepository.countByTenantId(tenantId))
                .totalDrivers(driverRepository.countByTenantId(tenantId))
                .totalRiders(riderRepository.countByTenantId(tenantId))
                .pendingRideRequests(rideRequestRepository.countByTenantIdAndRideRequestStatus(tenantId, RideRequestStatus.PENDING))
                .dispatchQueueDepth(rideOfferService.countOpenOffers(tenantId))
                .expiredOfferCount(rideOfferService.countExpiredOffers(tenantId))
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private Driver resolveAssignableDriver(Long driverId) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found with id: " + driverId));
        if (!tenantId.equals(driver.getTenantId())) {
            throw new RuntimeConflictException("Cross-tenant driver access is not allowed.");
        }
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
                .tenantId(tenantScopeService.requireCurrentTenantId())
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

    private String normalizeString(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
