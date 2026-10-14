package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideLocationDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.RideTrackingDriverDto;
import com.velo.platform.dto.RideTrackingDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.*;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.DispatchMode;
import com.velo.platform.events.RideCancelledEvent;
import com.velo.platform.events.RideEndedEvent;
import com.velo.platform.events.RideRequestedEvent;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.DriverService;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.PromoCodeService;
import com.velo.platform.services.RatingService;
import com.velo.platform.services.RideOfferService;
import com.velo.platform.services.RideService;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.PaymentService;
import com.velo.platform.services.DriverEarningsService;
import com.velo.platform.services.WalletService;
import com.velo.platform.strategies.RideStrategyManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiderServiceImpl implements RiderService {

    private static final long DRIVER_OFFER_TTL_SECONDS = 45L;

    private final ModelMapper modelMapper;
    private final RideStrategyManager rideStrategyManager;
    private final RideRequestRepository rideRequestRepository;
    private final RideRepository rideRepository;
    private final RiderRepository riderRepository;
    private final RideService rideService;
    private final DriverService driverService;
    private final RatingService ratingService;
    private final PromoCodeService promoCodeService;
    private final RideOfferService rideOfferService;
    private final NotificationService notificationService;
    private final TenantConfigurationRepository tenantConfigurationRepository;
    private final PaymentService paymentService;
    private final DriverEarningsService driverEarningsService;
    private final WalletService walletService;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public RideRequestDto requestRide(RideRequestDto rideRequestDto) {
        Rider rider = getCurrentRiderForUpdate();
        assertRiderPortalEnabled(rider.getTenantId());
        Long tenantId = resolveTenantId(rider.getTenantId());
        if (rideRequestRepository.existsByRiderAndTenantIdAndRideRequestStatusIn(
                rider,
                tenantId,
                List.of(RideRequestStatus.PENDING, RideRequestStatus.CONFIRMED)
        )) {
            throw new RuntimeConflictException("A pending or active ride request already exists for this rider.");
        }

        RideRequest rideRequest = modelMapper.map(rideRequestDto, RideRequest.class);
        rideRequest.setRideRequestStatus(RideRequestStatus.PENDING);
        rideRequest.setRider(rider);
        rideRequest.setTenantId(rider.getTenantId());

        BigDecimal fare = rideStrategyManager.rideFareCalculationStrategy().calculateFare(rideRequest);

        String promoCode = rideRequestDto.getPromoCode();
        if (promoCode != null && !promoCode.isBlank()) {
            com.velo.platform.dto.PromoCodeResultDto promoResult = 
                promoCodeService.validateAndApplyPromo(promoCode, rider.getUser(), fare);
            if (promoResult.isValid() && promoResult.getDiscountAmount() != null) {
                rideRequest.setPromoCode(promoCode);
                rideRequest.setDiscountAmount(promoResult.getDiscountAmount());
                fare = fare.subtract(promoResult.getDiscountAmount());
            }
        }

        rideRequest.setFare(fare);
        if (rideRequest.getPaymentMethod() == PaymentMethod.WALLET) {
            java.math.BigDecimal walletBalance = walletService.findByUser(rider.getUser()).getBalance();
            if (walletBalance.compareTo(fare) < 0) {
                throw new RuntimeConflictException("Insufficient wallet balance for this trip estimate.");
            }
        }

        RideRequest savedRideRequest = rideRequestRepository.save(rideRequest);

        List<Driver> matchedDrivers = rideStrategyManager
                .driverMatchingStrategy(rider.getRating())
                .findMatchingDrivers(savedRideRequest);

        rideOfferService.createOffers(savedRideRequest, matchedDrivers, DRIVER_OFFER_TTL_SECONDS);
        if (matchedDrivers.isEmpty()) {
            savedRideRequest.setRideRequestStatus(RideRequestStatus.EXPIRED);
            RideRequest expiredRequest = rideRequestRepository.save(savedRideRequest);
            notificationService.createNotification(
                    rider.getUser(),
                    "No drivers available",
                    "No nearby drivers were available for this request. Please try again shortly.",
                    NotificationType.RIDE_EXPIRED,
                    expiredRequest.getId()
            );
            return modelMapper.map(expiredRequest, RideRequestDto.class);
        }

        eventPublisher.publishEvent(new RideRequestedEvent(this, savedRideRequest, matchedDrivers, false));

        return modelMapper.map(savedRideRequest, RideRequestDto.class);
    }

    @Override
    @Transactional
    public RideDto cancelRide(Long rideId) {
        Rider rider = getCurrentRider();
        Ride ride = rideService.getRideById(rideId);

        if(!rider.equals(ride.getRider())) {
            throw new RuntimeConflictException(("Rider does not own this ride with id: "+rideId));
        }
        if (!resolveTenantId(ride.getTenantId()).equals(resolveTenantId(rider.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }

        if (!(ride.getRideStatus().equals(RideStatus.CONFIRMED) || ride.getRideStatus().equals(RideStatus.ONGOING))) {
            throw new RuntimeConflictException("Ride cannot be cancelled, invalid status: "+ride.getRideStatus());
        }

        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.CANCELLED);
        driverService.updateDriverAvailability(ride.getDriver(), true);

        eventPublisher.publishEvent(new RideCancelledEvent(this, savedRide));

        return modelMapper.map(savedRide, RideDto.class);
    }

    @Override
    @Transactional
    public RideDto endRide(Long rideId) {
        Rider rider = getCurrentRider();
        Ride ride = rideService.getRideById(rideId);

        if (!rider.equals(ride.getRider())) {
            throw new RuntimeConflictException("Rider does not own this ride with id: " + rideId);
        }
        if (!resolveTenantId(ride.getTenantId()).equals(resolveTenantId(rider.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }
        if (!RideStatus.ONGOING.equals(ride.getRideStatus())) {
            throw new RuntimeConflictException("Ride status is not ONGOING hence cannot be ended, status: " + ride.getRideStatus());
        }

        ride.setEndedAt(LocalDateTime.now());
        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.ENDED);
        driverService.updateDriverAvailability(savedRide.getDriver(), true);
        paymentService.processPayment(savedRide);
        driverEarningsService.createEarningRecord(savedRide);
        eventPublisher.publishEvent(new RideEndedEvent(this, savedRide));

        return modelMapper.map(savedRide, RideDto.class);
    }

    @Override
    @Transactional
    public DriverDto rateDriver(Long rideId, Integer rating) {
        Ride ride = rideService.getRideById(rideId);
        Rider rider = getCurrentRider();

        if(!rider.equals(ride.getRider())) {
            throw new RuntimeConflictException("Rider is not the owner of this Ride");
        }

        if(!ride.getRideStatus().equals(RideStatus.ENDED)) {
            throw new RuntimeConflictException("Ride status is not Ended hence cannot start rating, status: "+ride.getRideStatus());
        }

        return ratingService.rateDriver(ride, rating);
    }
    @Override
    @Transactional(readOnly = true)
    public RiderDto getMyProfile() {
        Rider currentRider = getCurrentRider();
        return modelMapper.map(currentRider, RiderDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RideDto> getAllMyRides(PageRequest pageRequest) {
        Rider currentRider = getCurrentRider();
        return rideService.getAllRidesOfRider(currentRider, pageRequest).map(
                ride -> modelMapper.map(ride, RideDto.class)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public RideRequestDto getCurrentRideRequest() {
        Rider currentRider = getCurrentRider();
        return rideRequestRepository
                .findTopByRiderAndTenantIdAndRideRequestStatusInOrderByRequestedTimeDesc(
                        currentRider,
                        resolveTenantId(currentRider.getTenantId()),
                        List.of(RideRequestStatus.PENDING, RideRequestStatus.CONFIRMED)
                )
                .map(rideRequest -> modelMapper.map(rideRequest, RideRequestDto.class))
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public RideTrackingDto getActiveRideTracking() {
        Rider currentRider = getCurrentRider();

        RideTrackingDto activeRideTracking = rideRepository
                .findTopByRiderAndRideStatusInOrderByCreatedTimeDesc(currentRider, List.of(RideStatus.CONFIRMED, RideStatus.ONGOING))
                .map(this::toRideTrackingDto)
                .orElse(null);
        if (activeRideTracking != null) {
            return activeRideTracking;
        }

        return rideRequestRepository
                .findTopByRiderAndRideRequestStatusInOrderByRequestedTimeDesc(
                        currentRider,
                        List.of(RideRequestStatus.PENDING, RideRequestStatus.SCHEDULED)
                )
                .map(this::toPendingRideTrackingDto)
                .orElse(null);
    }

    @Override
    @Transactional
    public Rider createNewRider(User user) {
        Rider rider = Rider
                .builder()
                .user(user)
                .tenantId(user.getTenantId() == null ? 1L : user.getTenantId())
                .rating(0.0)
                .build();
        return riderRepository.save(rider);
    }

    @Override
    @Transactional(readOnly = true)
    public Rider getCurrentRider() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return riderRepository.findByUserIdAndTenantId(principal.getUserId(), principal.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Rider not found for user id " + principal.getUserId()
                ));
    }

    private Rider getCurrentRiderForUpdate() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return riderRepository.findByUserIdAndTenantIdForUpdate(principal.getUserId(), principal.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Rider not found for user id " + principal.getUserId()
                ));
    }

    private RideTrackingDto toRideTrackingDto(Ride ride) {
        RideTrackingDto trackingDto = new RideTrackingDto();
        trackingDto.setRideId(ride.getId());
        trackingDto.setStatus(ride.getRideStatus() == null ? null : ride.getRideStatus().name());
        trackingDto.setPickupLocation(toPointDto(ride.getPickupLocation()));
        trackingDto.setDropOffLocation(toPointDto(ride.getDropOffLocation()));
        trackingDto.setUpdatedAt(resolveRideUpdatedAt(ride));
        trackingDto.setCanCancel(ride.getRideStatus() == RideStatus.CONFIRMED);
        trackingDto.setOtp(ride.getRideStatus() == RideStatus.CONFIRMED ? ride.getOtp() : null);

        if (ride.getDriver() != null) {
            Driver driver = ride.getDriver();
            trackingDto.setDriver(new RideTrackingDriverDto(
                    driver.getId(),
                    driver.getUser() == null ? null : driver.getUser().getFirstName(),
                    driver.getVehicleId(),
                    driver.getRating()
            ));

            if (driver.getCurrentLocation() != null) {
                trackingDto.setLastDriverLocation(new RideLocationDto(
                        driver.getCurrentLocation().getY(),
                        driver.getCurrentLocation().getX(),
                        null,
                        null,
                        null,
                        resolveRideUpdatedAt(ride)
                ));
            }
        }

        return trackingDto;
    }

    private RideTrackingDto toPendingRideTrackingDto(RideRequest rideRequest) {
        RideTrackingDto trackingDto = new RideTrackingDto();
        trackingDto.setRideRequestId(rideRequest.getId());
        trackingDto.setStatus(rideRequest.getRideRequestStatus() == null ? null : rideRequest.getRideRequestStatus().name());
        trackingDto.setPickupLocation(toPointDto(rideRequest.getPickupLocation()));
        trackingDto.setDropOffLocation(toPointDto(rideRequest.getDropOffLocation()));
        trackingDto.setUpdatedAt(rideRequest.getRequestedTime() == null ? LocalDateTime.now() : rideRequest.getRequestedTime());
        trackingDto.setCanCancel(true);
        return trackingDto;
    }

    private void assertRiderPortalEnabled(Long tenantId) {
        boolean riderPortalEnabled = tenantConfigurationRepository
                .findByTenant_Id(resolveTenantId(tenantId))
                .map(config -> config.getDispatchMode() != DispatchMode.DELIVERY_MERCHANT)
                .orElse(true);
        if (!riderPortalEnabled) {
            throw new RuntimeConflictException("Rider portal is disabled for this tenant dispatch mode.");
        }
    }

    private PointDto toPointDto(org.locationtech.jts.geom.Point point) {
        if (point == null) {
            return null;
        }
        return new PointDto(new double[]{point.getX(), point.getY()});
    }

    private LocalDateTime resolveRideUpdatedAt(Ride ride) {
        if (ride.getEndedAt() != null) {
            return ride.getEndedAt();
        }
        if (ride.getStartedAt() != null) {
            return ride.getStartedAt();
        }
        if (ride.getCreatedTime() != null) {
            return ride.getCreatedTime();
        }
        return LocalDateTime.now();
    }

    private Long resolveTenantId(Long tenantId) {
        return tenantId == null ? 1L : tenantId;
    }
}
