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
import com.velo.platform.dto.admin.AdminLiveDispatchDto;
import com.velo.platform.dto.admin.AdminLiveDispatchDriverDto;
import com.velo.platform.dto.admin.AdminLiveDispatchLocationDto;
import com.velo.platform.dto.admin.AdminLiveDispatchRideDto;
import com.velo.platform.entities.AdminDispatchAudit;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
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
import jakarta.persistence.EntityManager;
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

import java.sql.Timestamp;
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
    private final EntityManager entityManager;

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

        rideOfferService.createOffers(savedRequest, matchedDrivers);
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
    public AdminLiveDispatchDto getLiveDispatch() {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        LocalDateTime generatedAt = LocalDateTime.now();
        List<?> driverRows = entityManager.createNativeQuery(LIVE_DRIVERS_QUERY)
                .setParameter("tenantId", tenantId)
                .setParameter("freshSince", generatedAt.minusMinutes(15))
                .setParameter("generatedAt", generatedAt)
                .getResultList();
        List<AdminLiveDispatchDriverDto> drivers = driverRows.stream()
                .map(Object[].class::cast)
                .map(row -> toLiveDriver(row, generatedAt))
                .toList();
        List<?> rideRows = entityManager.createNativeQuery(LIVE_RIDES_QUERY)
                .setParameter("tenantId", tenantId)
                .getResultList();
        List<AdminLiveDispatchRideDto> rides = rideRows.stream()
                .map(Object[].class::cast)
                .map(this::toLiveRide)
                .toList();

        return new AdminLiveDispatchDto(generatedAt, drivers, rides);
    }

    private static final String LIVE_DRIVERS_QUERY = """
            SELECT d.id, u.first_name, u.last_name, d.vehicle_id, d.rating,
                   ST_Y(d.current_location), ST_X(d.current_location), d.location_heading,
                   d.location_speed_kph, d.location_updated_at, u.simulated,
                   active_ride.id, active_ride.ride_status
            FROM driver d
            JOIN app_user u ON u.id = d.user_id
            LEFT JOIN LATERAL (
                SELECT r.id, r.ride_status
                FROM ride r
                WHERE r.driver_id = d.id
                  AND r.tenant_id = d.tenant_id
                  AND r.ride_status IN ('CONFIRMED', 'ONGOING')
                ORDER BY CASE r.ride_status WHEN 'ONGOING' THEN 0 ELSE 1 END,
                         r.created_time DESC, r.id DESC
                LIMIT 1
            ) active_ride ON TRUE
            WHERE d.tenant_id = :tenantId
              AND d.onboarding_status = 'APPROVED'
              AND d.current_location IS NOT NULL
              AND d.location_updated_at >= :freshSince
              AND d.location_updated_at <= :generatedAt
              AND (d.available IS TRUE OR active_ride.id IS NOT NULL)
            ORDER BY d.id ASC
            LIMIT 500
            """;

    private static final String LIVE_RIDES_QUERY = """
            SELECT open_ride.ride_id, open_ride.ride_request_id, open_ride.status,
                   open_ride.rider_name, open_ride.driver_id,
                   open_ride.pickup_lat, open_ride.pickup_lng, open_ride.pickup_address,
                   open_ride.dropoff_lat, open_ride.dropoff_lng, open_ride.dropoff_address,
                   open_ride.requested_at, open_ride.started_at, open_ride.fare, open_ride.simulated
            FROM (
                SELECT NULL::bigint AS ride_id, rr.id AS ride_request_id,
                       'REQUESTED'::varchar AS status,
                       COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), rr.customer_name) AS rider_name,
                       NULL::bigint AS driver_id,
                       ST_Y(rr.pickup_location) AS pickup_lat, ST_X(rr.pickup_location) AS pickup_lng,
                       rr.pickup_address,
                       ST_Y(rr.drop_off_location) AS dropoff_lat, ST_X(rr.drop_off_location) AS dropoff_lng,
                       rr.drop_off_address AS dropoff_address,
                       rr.requested_time AS requested_at, NULL::timestamp AS started_at, rr.fare,
                       COALESCE(u.simulated, FALSE) AS simulated
                FROM ride_request rr
                LEFT JOIN rider ri ON ri.id = rr.rider_id
                LEFT JOIN app_user u ON u.id = ri.user_id
                WHERE rr.tenant_id = :tenantId
                  AND rr.ride_request_status = 'PENDING'
                  AND NOT EXISTS (
                      SELECT 1 FROM ride linked_ride WHERE linked_ride.ride_request_id = rr.id
                  )

                UNION ALL

                SELECT r.id AS ride_id, rr.id AS ride_request_id, r.ride_status AS status,
                       COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), rr.customer_name) AS rider_name,
                       r.driver_id,
                       ST_Y(COALESCE(r.pickup_location, rr.pickup_location)) AS pickup_lat,
                       ST_X(COALESCE(r.pickup_location, rr.pickup_location)) AS pickup_lng,
                       rr.pickup_address,
                       ST_Y(COALESCE(r.drop_off_location, rr.drop_off_location)) AS dropoff_lat,
                       ST_X(COALESCE(r.drop_off_location, rr.drop_off_location)) AS dropoff_lng,
                       rr.drop_off_address AS dropoff_address,
                       COALESCE(rr.requested_time, r.created_time) AS requested_at,
                       r.started_at, r.fare, COALESCE(u.simulated, FALSE) AS simulated
                FROM ride r
                LEFT JOIN ride_request rr ON rr.id = r.ride_request_id
                LEFT JOIN rider ri ON ri.id = r.rider_id
                LEFT JOIN app_user u ON u.id = ri.user_id
                WHERE r.tenant_id = :tenantId
                  AND r.ride_status IN ('CONFIRMED', 'ONGOING')
            ) open_ride
            ORDER BY open_ride.requested_at ASC NULLS LAST,
                     open_ride.ride_request_id ASC NULLS LAST,
                     open_ride.ride_id ASC NULLS LAST
            LIMIT 500
            """;

    private AdminLiveDispatchDriverDto toLiveDriver(Object[] row, LocalDateTime generatedAt) {
        LocalDateTime locationUpdatedAt = toLocalDateTime(row[9]);
        String rideStatus = (String) row[12];
        String status = RideStatus.ONGOING.name().equals(rideStatus)
                ? "ON_TRIP"
                : RideStatus.CONFIRMED.name().equals(rideStatus) ? "EN_ROUTE_TO_PICKUP" : "AVAILABLE";
        return new AdminLiveDispatchDriverDto(
                toLong(row[0]),
                joinName((String) row[1], (String) row[2]),
                (String) row[3],
                toDouble(row[4]),
                status,
                toDouble(row[5]),
                toDouble(row[6]),
                toDouble(row[7]),
                toDouble(row[8]),
                locationUpdatedAt,
                locationUpdatedAt.isBefore(generatedAt.minusSeconds(60)),
                Boolean.TRUE.equals(row[10]),
                toLong(row[11])
        );
    }

    private AdminLiveDispatchRideDto toLiveRide(Object[] row) {
        return new AdminLiveDispatchRideDto(
                toLong(row[0]),
                toLong(row[1]),
                (String) row[2],
                (String) row[3],
                toLong(row[4]),
                new AdminLiveDispatchLocationDto(toDouble(row[5]), toDouble(row[6]), (String) row[7]),
                new AdminLiveDispatchLocationDto(toDouble(row[8]), toDouble(row[9]), (String) row[10]),
                toLocalDateTime(row[11]),
                toLocalDateTime(row[12]),
                (java.math.BigDecimal) row[13],
                Boolean.TRUE.equals(row[14])
        );
    }

    private static String joinName(String firstName, String lastName) {
        String name = ((firstName == null ? "" : firstName.trim()) + " " + (lastName == null ? "" : lastName.trim())).trim();
        return name.isEmpty() ? null : name;
    }

    private static Long toLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static Double toDouble(Object value) {
        return value == null ? null : ((Number) value).doubleValue();
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        return null;
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
        addresses.putIfAbsent(key, new GeocodingResultDto(key, key, latitude, longitude, type));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminRideOfferDto> getRideOffers(Long rideRequestId) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RideRequest rideRequest = rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride request not found with id: " + rideRequestId));
        if (!tenantId.equals(rideRequest.getTenantId())) {
            throw new RuntimeConflictException("Cross-tenant ride request access is not allowed.");
        }
        boolean simulatedRequest = isSimulatedRideRequest(rideRequest);
        return rideOfferRepository.findByRideRequestIdAndTenantIdOrderByOfferedAtDesc(rideRequestId, tenantId)
                .stream()
                .filter(offer -> isSimulatedUser(offer.getDriver() == null ? null : offer.getDriver().getUser()) == simulatedRequest)
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

        Driver newDriver = resolveAssignableDriver(driverId, isSimulatedRideRequest(rideRequest));
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
        Driver newDriver = resolveAssignableDriver(newDriverId, isSimulatedRide(ride));

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

    private Driver resolveAssignableDriver(Long driverId, boolean simulatedRide) {
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
        if (isSimulatedUser(driver.getUser()) != simulatedRide) {
            throw new RuntimeConflictException(simulatedRide
                    ? "Simulated rides can only be assigned to simulated drivers."
                    : "Real rides cannot be assigned to simulated drivers.");
        }
        return driver;
    }

    private static boolean isSimulatedRideRequest(RideRequest rideRequest) {
        return rideRequest != null && isSimulatedRider(rideRequest.getRider());
    }

    private static boolean isSimulatedRide(Ride ride) {
        return ride != null && isSimulatedRider(ride.getRider());
    }

    private static boolean isSimulatedRider(Rider rider) {
        return rider != null && isSimulatedUser(rider.getUser());
    }

    private static boolean isSimulatedUser(User user) {
        return user != null && Boolean.TRUE.equals(user.getSimulated());
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
