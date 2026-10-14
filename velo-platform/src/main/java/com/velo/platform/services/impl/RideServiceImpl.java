package com.velo.platform.services.impl;

import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.services.RideRequestService;
import com.velo.platform.services.RideService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class RideServiceImpl implements RideService {

    private static final SecureRandom OTP_RANDOM = new SecureRandom();

    private final RideRepository rideRepository;
    private final RideRequestRepository rideRequestRepository;
    private final RideRequestService rideRequestService;
    private final ModelMapper modelMapper;

    @Override
    @Transactional(readOnly = true)
    public Ride getRideById(Long rideId) {
        return rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found with id: "+rideId));
    }

    @Override
    @Transactional
    public Ride createNewRide(RideRequest rideRequest, Driver driver) {
        rideRequest.setRideRequestStatus(RideRequestStatus.CONFIRMED);

        Ride ride = modelMapper.map(rideRequest, Ride.class);
        ride.setTenantId(rideRequest.getTenantId());
        ride.setRideStatus(RideStatus.CONFIRMED);
        ride.setDriver(driver);
        ride.setOtp(rideRequest.getRider() == null ? null : generateRandomOTP());
        ride.setId(null);

        rideRequestService.update(rideRequest);
        return rideRepository.save(ride);
    }

    @Override
    @Transactional
    public Ride updateRideStatus(Ride ride, RideStatus rideStatus) {
        validateTransition(ride.getRideStatus(), rideStatus);
        ride.setRideStatus(rideStatus);
        Ride savedRide = rideRepository.save(ride);
        syncRideRequestStatus(savedRide);
        return savedRide;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Ride> getAllRidesOfRider(Rider rider, PageRequest pageRequest) {
        return rideRepository.findByRider(rider, pageRequest);
    }


    @Override
    @Transactional(readOnly = true)
    public Page<Ride> getAllRidesOfDriver(Driver driver, PageRequest pageRequest) {
        return rideRepository.findByDriver(driver, pageRequest);
    }

    private String generateRandomOTP() {
        int otpInt = OTP_RANDOM.nextInt(10000);
        return String.format("%04d", otpInt);
    }

    private void validateTransition(RideStatus current, RideStatus next) {
        if (current == null || current == next) {
            return;
        }

        boolean valid = switch (current) {
            case CONFIRMED -> next == RideStatus.ONGOING || next == RideStatus.CANCELLED;
            case ONGOING -> next == RideStatus.ENDED || next == RideStatus.CANCELLED;
            case CANCELLED, ENDED -> false;
        };

        if (!valid) {
            throw new RuntimeConflictException(
                    "Invalid ride state transition from " + current + " to " + next + "."
            );
        }
    }

    private void syncRideRequestStatus(Ride ride) {
        if (ride.getRider() == null || ride.getRideStatus() == null) {
            return;
        }

        if (ride.getRideStatus() != RideStatus.CANCELLED && ride.getRideStatus() != RideStatus.ENDED) {
            return;
        }

        RideRequestStatus nextRequestStatus = ride.getRideStatus() == RideStatus.CANCELLED
                ? RideRequestStatus.CANCELLED
                : RideRequestStatus.EXPIRED; // DEMO_STUB: dedicated COMPLETED request status can replace this in a follow-up sprint.

        rideRequestRepository
                .findTopByRiderAndRideRequestStatusOrderByRequestedTimeDesc(ride.getRider(), RideRequestStatus.CONFIRMED)
                .ifPresent(rideRequest -> {
                    rideRequest.setRideRequestStatus(nextRequestStatus);
                    rideRequestRepository.save(rideRequest);
                });
    }
}
