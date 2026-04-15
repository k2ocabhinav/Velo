package com.velo.platform.services;

import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.admin.AdminCreateDispatchRequestDto;
import com.velo.platform.dto.admin.AdminActiveRideDto;
import com.velo.platform.dto.admin.AdminDispatchAuditDto;
import com.velo.platform.dto.admin.AdminOpsHealthDto;
import com.velo.platform.dto.admin.AdminPendingRideRequestDto;
import com.velo.platform.dto.admin.AdminRideOfferDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AdminDispatchService {

    RideRequestDto createDispatchRequest(AdminCreateDispatchRequestDto requestDto);

    Page<AdminPendingRideRequestDto> getPendingRideRequests(Pageable pageable);

    Page<AdminActiveRideDto> getActiveRides(Pageable pageable);

    List<AdminRideOfferDto> getRideOffers(Long rideRequestId);

    Page<AdminDispatchAuditDto> getDispatchAudit(Pageable pageable);

    RideDto assignPendingRideRequest(Long rideRequestId, Long driverId, String reason);

    RideDto reassignRide(Long rideId, Long newDriverId, String reason);

    RideRequestDto forceCancelRideRequest(Long rideRequestId, String reason);

    RideDto forceCancelRide(Long rideId, String reason);

    AdminOpsHealthDto getOpsHealth();
}
