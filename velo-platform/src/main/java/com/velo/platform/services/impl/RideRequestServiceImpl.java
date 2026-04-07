package com.velo.platform.services.impl;

import com.velo.platform.entities.RideRequest;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.services.RideRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RideRequestServiceImpl implements RideRequestService {

    private final RideRequestRepository rideRequestRepository;

    @Override
    @Transactional(readOnly = true)
    public RideRequest findRideRequestById(Long rideRequestId) {
        return rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("RideRequest not found with id: "+rideRequestId));
    }

    @Override
    @Transactional
    public void update(RideRequest rideRequest) {
        rideRequestRepository.findById(rideRequest.getId())
                .orElseThrow(() -> new ResourceNotFoundException("RideRequest not found with id: "+rideRequest.getId()));
        rideRequestRepository.save(rideRequest);
    }
}
