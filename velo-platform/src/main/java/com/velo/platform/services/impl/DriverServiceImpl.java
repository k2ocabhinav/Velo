package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.DriverLocationDto;
import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.events.RideAcceptedEvent;
import com.velo.platform.events.RideCancelledEvent;
import com.velo.platform.events.RideEndedEvent;
import com.velo.platform.events.RideStartedEvent;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.*;
import com.velo.platform.utils.GeometryUtil;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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
    private final RideService rideService;
    private final ModelMapper modelMapper;
    private final PaymentService paymentService;
    private final RatingService ratingService;
    private final DriverEarningsService driverEarningsService;
    private final ApplicationEventPublisher eventPublisher;
    private final RideRealtimeService rideRealtimeService;

    @Override
    @Transactional
    public RideDto acceptRide(Long rideRequestId) {
        RideRequest rideRequest = rideRequestService.findRideRequestById(rideRequestId);

        if(!rideRequest.getRideRequestStatus().equals(RideRequestStatus.PENDING)) {
            throw new RuntimeConflictException("RideRequest cannot be accepted, status is "+ rideRequest.getRideRequestStatus());
        }

        Driver currentDriver = getCurrentDriver();
        if(!currentDriver.getAvailable()) {
            throw new RuntimeConflictException("Driver cannot accept ride due to unavailability");
        }

        currentDriver.setAvailable(false);
        Driver savedDriver = driverRepository.save(currentDriver);

        Ride ride = rideService.createNewRide(rideRequest, savedDriver);

        eventPublisher.publishEvent(new RideAcceptedEvent(this, ride, currentDriver));

        return modelMapper.map(ride, RideDto.class);
    }

    @Override
    @Transactional
    public RideDto cancelRide(Long rideId) {
        Ride ride = rideService.getRideById(rideId);

        Driver driver = getCurrentDriver();
        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver cannot start a ride as he has not accepted it earlier");
        }

        if(!ride.getRideStatus().equals(RideStatus.CONFIRMED)) {
            throw new RuntimeConflictException("Ride cannot be cancelled, invalid status: "+ride.getRideStatus());
        }

        rideService.updateRideStatus(ride, RideStatus.CANCELLED);
        updateDriverAvailability(driver, true);

        eventPublisher.publishEvent(new RideCancelledEvent(this, ride));

        return modelMapper.map(ride, RideDto.class);
    }

    @Override
    @Transactional
    public RideDto startRide(Long rideId, String otp) {
        Ride ride = rideService.getRideById(rideId);
        Driver driver = getCurrentDriver();

        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver cannot start a ride as he has not accepted it earlier");
        }

        if(!ride.getRideStatus().equals(RideStatus.CONFIRMED)) {
            throw new RuntimeConflictException("Ride status is not CONFIRMED hence cannot be started, status: "+ride.getRideStatus());
        }

        if(!otp.equals(ride.getOtp())) {
            throw new RuntimeConflictException("Otp is not valid, otp: "+otp);
        }

        ride.setStartedAt(LocalDateTime.now());
        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.ONGOING);

        paymentService.createNewPayment(savedRide);
        ratingService.createNewRating(savedRide);

        eventPublisher.publishEvent(new RideStartedEvent(this, savedRide));

        return modelMapper.map(savedRide, RideDto.class);
    }

    @Override
    @Transactional
    public RideDto endRide(Long rideId) {
        Ride ride = rideService.getRideById(rideId);
        Driver driver = getCurrentDriver();

        if(!driver.equals(ride.getDriver())) {
            throw new RuntimeConflictException("Driver cannot start a ride as he has not accepted it earlier");
        }

        if(!ride.getRideStatus().equals(RideStatus.ONGOING)) {
            throw new RuntimeConflictException("Ride status is not ONGOING hence cannot be ended, status: "+ride.getRideStatus());
        }

        ride.setEndedAt(LocalDateTime.now());
        Ride savedRide = rideService.updateRideStatus(ride, RideStatus.ENDED);
        updateDriverAvailability(driver, true);

        paymentService.processPayment(ride);

        eventPublisher.publishEvent(new RideEndedEvent(this, savedRide));

        // Auto-create earning record for the driver
        driverEarningsService.createEarningRecord(ride);

        return modelMapper.map(savedRide, RideDto.class);
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
        return modelMapper.map(currentDriver, DriverDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RideDto> getAllMyRides(PageRequest pageRequest) {
        Driver currentDriver = getCurrentDriver();
        return rideService.getAllRidesOfDriver(currentDriver, pageRequest).map(
                ride -> modelMapper.map(ride, RideDto.class)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Driver getCurrentDriver() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return driverRepository.findByUserId(principal.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found for user id " + principal.getUserId()));
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
        return driverRepository.save(driver);
    }

    @Override
    @Transactional
    public DriverLocationDto updateDriverLocation(DriverLocationUpdateRequestDto locationUpdate) {
        Driver driver = getCurrentDriver();

        DriverLocationUpdateRequestDto normalizedUpdate = normalizeLocationUpdate(locationUpdate);
        PointDto pointDto = new PointDto(new double[]{normalizedUpdate.getLng(), normalizedUpdate.getLat()});
        driver.setCurrentLocation(GeometryUtil.createPoint(pointDto));
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

}
