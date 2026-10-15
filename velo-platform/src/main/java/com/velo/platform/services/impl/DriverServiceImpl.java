package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.DriverLocationDto;
import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.events.RideAcceptedEvent;
import com.velo.platform.events.RideCancelledEvent;
import com.velo.platform.events.RideEndedEvent;
import com.velo.platform.events.RideStartedEvent;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.*;
import com.velo.platform.utils.GeometryUtil;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverServiceImpl implements DriverService {

    private final RideRequestService rideRequestService;
    private final DriverRepository driverRepository;
    private final RideRepository rideRepository;
    private final RideRequestRepository rideRequestRepository;
    private final RideService rideService;
    private final ModelMapper modelMapper;
    private final PaymentService paymentService;
    private final RatingService ratingService;
    private final DriverEarningsService driverEarningsService;
    private final ApplicationEventPublisher eventPublisher;
    private final RideRealtimeService rideRealtimeService;
    private final RideOfferService rideOfferService;

    @Override
    @Transactional
    public RideDto acceptRide(Long rideRequestId) {
        Driver currentDriver = getCurrentDriver();
        RideRequest rideRequest = rideRequestService.findRideRequestById(rideRequestId);
        if (!resolveTenantId(rideRequest.getTenantId()).equals(resolveTenantId(currentDriver.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride request access is not allowed.");
        }

        RideOffer acceptedOffer = null;
        if (rideOfferService.hasAnyOffer(rideRequestId)) {
            acceptedOffer = rideOfferService
                    .findAcceptableOffer(rideRequestId, currentDriver.getId())
                    .orElseThrow(() -> new RuntimeConflictException("This ride has already been assigned."));
        }

        if(!RideRequestStatus.PENDING.equals(rideRequest.getRideRequestStatus())) {
            if (acceptedOffer != null) {
                rideOfferService.markRevoked(acceptedOffer, "Ride request is no longer pending.");
            }
            throw new RuntimeConflictException("This ride has already been assigned or cancelled.");
        }

        if(!currentDriver.getAvailable()) {
            throw new RuntimeConflictException("Driver cannot accept ride due to unavailability");
        }

        try {
            int claimed = rideRequestRepository.compareAndSetStatus(
                rideRequestId,
                resolveTenantId(rideRequest.getTenantId()),
                RideRequestStatus.PENDING,
                RideRequestStatus.CONFIRMED
            );
            if (claimed == 0) {
                if (acceptedOffer != null) {
                    rideOfferService.markRevoked(acceptedOffer, "Ride accepted by another driver.");
                }
                throw new RuntimeConflictException("This ride has already been assigned.");
            }

            currentDriver.setAvailable(false);
            Driver savedDriver = driverRepository.save(currentDriver);
            Ride ride = rideService.createNewRide(rideRequest, savedDriver);
            if (acceptedOffer != null) {
                rideOfferService.markAccepted(acceptedOffer);
                rideOfferService.revokeCompetingOffers(
                        rideRequestId,
                        savedDriver.getId(),
                        "Ride accepted by another driver."
                );
            }

            eventPublisher.publishEvent(new RideAcceptedEvent(this, ride, currentDriver));
            return toRideDto(ride);
        } catch (ObjectOptimisticLockingFailureException optimisticFailure) {
            if (acceptedOffer != null) {
                rideOfferService.markRevoked(acceptedOffer, "Ride accepted by another driver.");
            }
            throw new RuntimeConflictException("This ride has already been assigned.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public RideRequestDto getRideRequestForAcceptance(Long rideRequestId) {
        Driver currentDriver = getCurrentDriver();
        RideRequest rideRequest = rideRequestService.findRideRequestById(rideRequestId);

        if (!resolveTenantId(rideRequest.getTenantId()).equals(resolveTenantId(currentDriver.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride request access is not allowed.");
        }
        if (!RideRequestStatus.PENDING.equals(rideRequest.getRideRequestStatus())) {
            return toRideRequestDto(rideRequest, null);
        }
        LocalDateTime expiresAt = null;
        if (rideOfferService.hasAnyOffer(rideRequestId)) {
            RideOffer offer = rideOfferService.findAcceptableOffer(rideRequestId, currentDriver.getId())
                    .orElseThrow(() -> new RuntimeConflictException("This ride has already been assigned."));
            expiresAt = offer.getExpiresAt();
        }

        return toRideRequestDto(rideRequest, expiresAt);
    }

    private RideRequestDto toRideRequestDto(RideRequest rideRequest, LocalDateTime expiresAt) {
        RideRequestDto dto = modelMapper.map(rideRequest, RideRequestDto.class);
        dto.setPickupAddress(rideRequest.getPickupAddress());
        dto.setDropOffAddress(rideRequest.getDropOffAddress());
        dto.setExpiresAt(expiresAt);
        Rider rider = rideRequest.getRider();
        if (rider != null && rider.getUser() != null) {
            RiderDto riderDto = dto.getRider();
            if (riderDto == null) {
                riderDto = modelMapper.map(rider, RiderDto.class);
            }
            populateRiderName(rider, riderDto);
            dto.setRider(riderDto);
        }
        return dto;
    }

    @Override
    @Transactional
    public RideDto cancelRide(Long rideId) {
        Ride ride = rideService.getRideById(rideId);

        Driver driver = getCurrentDriver();
        if (!resolveTenantId(ride.getTenantId()).equals(resolveTenantId(driver.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }
        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver cannot start a ride as he has not accepted it earlier");
        }

        if(!ride.getRideStatus().equals(RideStatus.CONFIRMED)) {
            throw new RuntimeConflictException("Ride cannot be cancelled, invalid status: "+ride.getRideStatus());
        }

        rideService.updateRideStatus(ride, RideStatus.CANCELLED);
        updateDriverAvailability(driver, true);

        eventPublisher.publishEvent(new RideCancelledEvent(this, ride));

        return toRideDto(ride);
    }

    @Override
    @Transactional
    public RideDto startRide(Long rideId, String otp) {
        Ride ride = rideService.getRideById(rideId);
        Driver driver = getCurrentDriver();
        if (!resolveTenantId(ride.getTenantId()).equals(resolveTenantId(driver.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }

        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver cannot start a ride as he has not accepted it earlier");
        }

        if(!ride.getRideStatus().equals(RideStatus.CONFIRMED)) {
            throw new RuntimeConflictException("Ride status is not CONFIRMED hence cannot be started, status: "+ride.getRideStatus());
        }

        if (ride.getOtp() != null && !ride.getOtp().equals(otp == null ? null : otp.trim())) {
            throw new RuntimeConflictException("Otp is not valid.");
        }

        ride.setStartedAt(LocalDateTime.now());
        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.ONGOING);

        paymentService.createNewPayment(savedRide);
        ratingService.createNewRating(savedRide);

        eventPublisher.publishEvent(new RideStartedEvent(this, savedRide));

        return toRideDto(savedRide);
    }

    @Override
    @Transactional
    public RideDto endRide(Long rideId) {
        Ride ride = rideService.getRideById(rideId);
        Driver driver = getCurrentDriver();
        if (!resolveTenantId(ride.getTenantId()).equals(resolveTenantId(driver.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride access is not allowed.");
        }

        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver cannot start a ride as he has not accepted it earlier");
        }

        if(!ride.getRideStatus().equals(RideStatus.ONGOING)) {
            throw new RuntimeConflictException("Ride status is not ONGOING hence cannot be ended, status: "+ride.getRideStatus());
        }

        ride.setEndedAt(LocalDateTime.now());
        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.ENDED);
        updateDriverAvailability(driver, true);

        paymentService.processPayment(savedRide);

        eventPublisher.publishEvent(new RideEndedEvent(this, savedRide));

        // Auto-create earning record for the driver
        driverEarningsService.createEarningRecord(savedRide);

        return toRideDto(savedRide);
    }

    @Override
    @Transactional
    public RiderDto rateRider(Long rideId, Integer rating) {
        Ride ride = rideService.getRideById(rideId);
        Driver driver = getCurrentDriver();

        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver is not the owner of this Ride");
        }

        if(!ride.getRideStatus().equals(RideStatus.ENDED)) {
            throw new RuntimeConflictException("Ride status is not Ended hence cannot start rating, status: "+ride.getRideStatus());
        }

        return ratingService.rateRider(ride, rating);
    }

    @Override
    @Transactional(readOnly = true)
    public DriverDto getMyProfile() {
        Driver currentDriver = getCurrentDriver();
        DriverDto driverDto = modelMapper.map(currentDriver, DriverDto.class);
        populateDriverName(currentDriver, driverDto);
        return driverDto;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RideDto> getAllMyRides(PageRequest pageRequest) {
        Driver currentDriver = getCurrentDriver();
        return rideService.getAllRidesOfDriver(currentDriver, pageRequest).map(
                this::toRideDto
        );
    }

    private RideDto toRideDto(Ride ride) {
        RideDto dto = modelMapper.map(ride, RideDto.class);
        Rider rider = ride.getRider();
        if (rider == null || rider.getUser() == null) {
            return dto;
        }

        RiderDto riderDto = dto.getRider();
        if (riderDto == null) {
            riderDto = modelMapper.map(rider, RiderDto.class);
            dto.setRider(riderDto);
        }
        populateRiderName(rider, riderDto);
        return dto;
    }

    private void populateRiderName(Rider rider, RiderDto riderDto) {
        UserDto userDto = riderDto.getUser();
        if (userDto == null) {
            userDto = modelMapper.map(rider.getUser(), UserDto.class);
            riderDto.setUser(userDto);
        }

        populateUserName(rider.getUser(), userDto);
    }

    private void populateDriverName(Driver driver, DriverDto driverDto) {
        User user = driver.getUser();
        if (user == null) {
            return;
        }

        UserDto userDto = driverDto.getUser();
        if (userDto == null) {
            userDto = modelMapper.map(user, UserDto.class);
            driverDto.setUser(userDto);
        }

        populateUserName(user, userDto);
    }

    private void populateUserName(User user, UserDto userDto) {
        String fullName = ((user.getFirstName() == null ? "" : user.getFirstName().trim()) + " "
                + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        userDto.setName(fullName.isEmpty() ? null : fullName);
    }

    @Override
    @Transactional(readOnly = true)
    public Driver getCurrentDriver() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return driverRepository.findByUserIdAndTenantId(principal.getUserId(), principal.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Driver not found for user id " + principal.getUserId() +
                        ". Please sign in with a driver account."
                ));
    }

    @Override
    @Transactional
    public DriverDto updateDriverAvailability(boolean available) {
        Driver driver = getCurrentDriver();
        return updateDriverAvailability(driver, available);
    }

    @Override
    @Transactional
    public DriverDto updateDriverAvailability(Driver driver, boolean available) {
        if (driver.getAvailable() != null && driver.getAvailable() == available) {
            return modelMapper.map(driver, DriverDto.class);
        }

        if (!available && Boolean.TRUE.equals(driver.getAvailable())) {
            List<Ride> activeRides = rideRepository.findByDriverAndRideStatusIn(
                    driver,
                    List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)
            );
            if (!activeRides.isEmpty()) {
                throw new RuntimeConflictException("Cannot go offline with active rides. Please complete or cancel active rides first.");
            }
        }

        driverRepository.updateAvailabilityById(driver.getId(), available);
        DriverDto dto = modelMapper.map(driver, DriverDto.class);
        dto.setAvailable(available);
        return dto;
    }

    @Override
    @Transactional
    public Driver createNewDriver(Driver driver) {
        if (driver.getTenantId() == null && driver.getUser() != null) {
            driver.setTenantId(driver.getUser().getTenantId() == null ? 1L : driver.getUser().getTenantId());
        }
        return driverRepository.save(driver);
    }

    @Override
    @Transactional
    public DriverLocationDto updateDriverLocation(DriverLocationUpdateRequestDto locationUpdate) {
        Driver driver = getCurrentDriver();

        DriverLocationUpdateRequestDto normalizedUpdate = normalizeLocationUpdate(locationUpdate);
        PointDto pointDto = new PointDto(new double[]{normalizedUpdate.getLng(), normalizedUpdate.getLat()});
        driver.setCurrentLocation(GeometryUtil.createPoint(pointDto));
        driver.setLocationUpdatedAt(LocalDateTime.now());
        driver.setLocationHeading(normalizedUpdate.getHeading());
        driver.setLocationSpeedKph(normalizedUpdate.getSpeedKph());
        driverRepository.save(driver);

        rideRepository
                .findTopByDriverAndRideStatusInOrderByCreatedTimeDesc(
                        driver,
                        List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)
                )
                .ifPresent(ride -> rideRealtimeService.publishDriverLocation(ride, normalizedUpdate));

        return new DriverLocationDto(
                normalizedUpdate.getLat(),
                normalizedUpdate.getLng(),
                normalizedUpdate.getHeading(),
                normalizedUpdate.getSpeedKph(),
                normalizedUpdate.getAccuracyM(),
                normalizedUpdate.getCapturedAt(),
                LocalDateTime.now()
        );
    }

    private DriverLocationUpdateRequestDto normalizeLocationUpdate(DriverLocationUpdateRequestDto locationUpdate) {
        DriverLocationUpdateRequestDto update = new DriverLocationUpdateRequestDto();
        update.setLat(locationUpdate.getLat());
        update.setLng(locationUpdate.getLng());
        update.setHeading(locationUpdate.getHeading());
        update.setSpeedKph(locationUpdate.getSpeedKph());
        update.setAccuracyM(locationUpdate.getAccuracyM());
        update.setCapturedAt(locationUpdate.getCapturedAt() == null ? LocalDateTime.now() : locationUpdate.getCapturedAt());
        return update;
    }

    private Long resolveTenantId(Long tenantId) {
        return tenantId == null ? 1L : tenantId;
    }

}
