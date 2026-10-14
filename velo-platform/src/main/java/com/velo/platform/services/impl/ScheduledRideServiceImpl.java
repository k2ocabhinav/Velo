package com.velo.platform.services.impl;

import com.velo.platform.configs.ScheduledRideConfig;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.ScheduledRideDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.events.RideRequestedEvent;
import com.velo.platform.events.ScheduledRideCancelledEvent;
import com.velo.platform.events.ScheduledRideCreatedEvent;
import com.velo.platform.events.ScheduledRideRescheduledEvent;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideOfferService;
import com.velo.platform.services.ScheduledRideService;
import com.velo.platform.services.TenantScopeService;
import com.velo.platform.strategies.RideStrategyManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduledRideServiceImpl implements ScheduledRideService {

    private static final ZoneId UTC = ZoneId.of("UTC");
    private static final long DRIVER_OFFER_TTL_SECONDS = 45L;

    private final RideRequestRepository rideRequestRepository;
    private final RiderService riderService;
    private final RideStrategyManager rideStrategyManager;
    private final ScheduledRideConfig scheduledRideConfig;
    private final ModelMapper modelMapper;
    private final RideOfferService rideOfferService;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final TenantScopeService tenantScopeService;
    private final PlatformTransactionManager transactionManager;

    @Override
    @Transactional
    public ScheduledRideDto scheduleRide(RideRequestDto rideRequestDto) {
        LocalDateTime scheduledTime = rideRequestDto.getScheduledTime();
        validateScheduledTime(scheduledTime);

        Rider rider = riderService.getCurrentRider();

        RideRequest rideRequest = modelMapper.map(rideRequestDto, RideRequest.class);
        rideRequest.setRider(rider);
        rideRequest.setTenantId(rider.getTenantId());
        rideRequest.setRideRequestStatus(RideRequestStatus.SCHEDULED);
        rideRequest.setScheduledTime(scheduledTime);

        BigDecimal fare = rideStrategyManager.rideFareCalculationStrategy().calculateFare(rideRequest);
        rideRequest.setFare(fare);

        RideRequest saved = rideRequestRepository.save(rideRequest);
        eventPublisher.publishEvent(new ScheduledRideCreatedEvent(this, saved));
        log.info("Scheduled ride created: id={}, scheduledTime={}", saved.getId(), scheduledTime);

        return toScheduledRideDto(saved);
    }

    @Override
    @Transactional
    public ScheduledRideDto cancelScheduledRide(Long rideRequestId) {
        RideRequest rideRequest = findOwnedScheduledRequest(rideRequestId);

        rideRequest.setRideRequestStatus(RideRequestStatus.CANCELLED);
        RideRequest saved = rideRequestRepository.save(rideRequest);
        eventPublisher.publishEvent(new ScheduledRideCancelledEvent(this, saved));
        log.info("Scheduled ride cancelled: id={}", rideRequestId);

        return toScheduledRideDto(saved);
    }

    @Override
    @Transactional
    public ScheduledRideDto rescheduleRide(Long rideRequestId, LocalDateTime newScheduledTime) {
        validateScheduledTime(newScheduledTime);

        RideRequest rideRequest = findOwnedScheduledRequest(rideRequestId);
        rideRequest.setScheduledTime(newScheduledTime);

        BigDecimal fare = rideStrategyManager.rideFareCalculationStrategy().calculateFare(rideRequest);
        rideRequest.setFare(fare);

        RideRequest saved = rideRequestRepository.save(rideRequest);
        eventPublisher.publishEvent(new ScheduledRideRescheduledEvent(this, saved));
        log.info("Scheduled ride rescheduled: id={}, newTime={}", rideRequestId, newScheduledTime);

        return toScheduledRideDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ScheduledRideDto> getMyScheduledRides(PageRequest pageRequest) {
        Rider rider = riderService.getCurrentRider();
        return rideRequestRepository
                .findByRiderAndRideRequestStatusOrderByScheduledTimeAsc(rider, RideRequestStatus.SCHEDULED, pageRequest)
                .map(this::toScheduledRideDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ScheduledRideDto> getAllScheduledRides(PageRequest pageRequest) {
        return rideRequestRepository
                .findByTenantIdAndRideRequestStatusOrderByScheduledTimeAsc(
                        tenantScopeService.requireCurrentTenantId(), RideRequestStatus.SCHEDULED, pageRequest)
                .map(this::toScheduledRideDto);
    }

    @Override
    public int dispatchScheduledRides() {
        LocalDateTime dispatchBefore = LocalDateTime.now(UTC)
                .plusMinutes(scheduledRideConfig.getDispatchWindowMinutes());

        List<Long> dueRideIds = rideRequestRepository
                .findDueScheduledRideIds(RideRequestStatus.SCHEDULED, dispatchBefore);
        TransactionTemplate perRideTransaction = new TransactionTemplate(transactionManager);
        perRideTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        int dispatched = 0;
        for (Long rideRequestId : dueRideIds) {
            try {
                Boolean didDispatch = perRideTransaction.execute(status -> dispatchScheduledRide(rideRequestId));
                if (Boolean.TRUE.equals(didDispatch)) {
                    dispatched++;
                }
            } catch (Exception e) {
                log.error("Failed to dispatch scheduled ride id={}: {}",
                        rideRequestId, e.getMessage(), e);
            }
        }

        if (dispatched > 0) {
            log.info("Scheduled ride dispatch complete: dispatched={}/{}", dispatched, dueRideIds.size());
        }
        return dispatched;
    }

    private boolean dispatchScheduledRide(Long rideRequestId) {
        RideRequest rideRequest = rideRequestRepository
                .findByIdAndRideRequestStatusForUpdate(rideRequestId, RideRequestStatus.SCHEDULED)
                .orElse(null);
        if (rideRequest == null) {
            return false;
        }

        rideRequest.setRideRequestStatus(RideRequestStatus.PENDING);
        RideRequest savedRideRequest = rideRequestRepository.save(rideRequest);

        Rider rider = savedRideRequest.getRider();
        List<Driver> matchedDrivers = rideStrategyManager
                .driverMatchingStrategy(rider.getRating())
                .findMatchingDrivers(savedRideRequest);

        rideOfferService.createOffers(savedRideRequest, matchedDrivers, DRIVER_OFFER_TTL_SECONDS);
        if (matchedDrivers.isEmpty()) {
            savedRideRequest.setRideRequestStatus(RideRequestStatus.EXPIRED);
            rideRequestRepository.save(savedRideRequest);
            notificationService.createNotification(
                    rider.getUser(),
                    "No drivers available for scheduled ride",
                    "We could not find available drivers for the scheduled ride dispatch window.",
                    NotificationType.RIDE_EXPIRED,
                    savedRideRequest.getId()
            );
            return false;
        }

        eventPublisher.publishEvent(new RideRequestedEvent(this, savedRideRequest, matchedDrivers, true));
        log.info("Dispatched scheduled ride: id={}, matchedDrivers={}",
                savedRideRequest.getId(), matchedDrivers.size());
        return true;
    }

    private void validateScheduledTime(LocalDateTime scheduledTime) {
        if (scheduledTime == null) {
            throw new RuntimeConflictException("Scheduled time is required");
        }

        LocalDateTime now = LocalDateTime.now(UTC);
        LocalDateTime minTime = now.plusMinutes(scheduledRideConfig.getMinAdvanceMinutes());
        LocalDateTime maxTime = now.plusDays(scheduledRideConfig.getMaxAdvanceDays());

        if (scheduledTime.isBefore(minTime)) {
            throw new RuntimeConflictException(
                    "Scheduled time must be at least " + scheduledRideConfig.getMinAdvanceMinutes() +
                    " minutes from now");
        }

        if (scheduledTime.isAfter(maxTime)) {
            throw new RuntimeConflictException(
                    "Scheduled time cannot be more than " + scheduledRideConfig.getMaxAdvanceDays() +
                    " days from now");
        }
    }

    private RideRequest findOwnedScheduledRequest(Long rideRequestId) {
        RideRequest rideRequest = rideRequestRepository.findById(rideRequestId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Ride request not found with id: " + rideRequestId));

        Rider rider = riderService.getCurrentRider();
        if (!rider.equals(rideRequest.getRider())) {
            throw new RuntimeConflictException("You do not own this ride request");
        }
        if (!resolveTenantId(rider.getTenantId()).equals(resolveTenantId(rideRequest.getTenantId()))) {
            throw new RuntimeConflictException("Cross-tenant ride request access is not allowed.");
        }

        if (rideRequest.getRideRequestStatus() != RideRequestStatus.SCHEDULED) {
            throw new RuntimeConflictException(
                    "Ride request is not in SCHEDULED status, current status: " +
                    rideRequest.getRideRequestStatus());
        }

        return rideRequest;
    }

    private ScheduledRideDto toScheduledRideDto(RideRequest rideRequest) {
        ScheduledRideDto dto = modelMapper.map(rideRequest, ScheduledRideDto.class);
        dto.setStatus(rideRequest.getRideRequestStatus());
        return dto;
    }

    private Long resolveTenantId(Long tenantId) {
        return tenantId == null ? 1L : tenantId;
    }
}
