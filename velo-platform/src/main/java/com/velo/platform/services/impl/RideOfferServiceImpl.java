package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.RideOfferStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.configs.DispatchProperties;
import com.velo.platform.repositories.RideOfferRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideOfferService;
import com.velo.platform.services.RideRealtimeService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RideOfferServiceImpl implements RideOfferService {

    private final RideOfferRepository rideOfferRepository;
    private final RideRequestRepository rideRequestRepository;
    private final NotificationService notificationService;
    private final RideRealtimeService rideRealtimeService;
    private final DispatchProperties dispatchProperties;
    private final EntityManager entityManager;

    @Override
    @Transactional
    public List<RideOffer> createOffers(RideRequest rideRequest, List<Driver> drivers) {
        if (rideRequest == null || drivers == null || drivers.isEmpty()) {
            return List.of();
        }

        LocalDateTime expiry = UtcTimes.now().plusSeconds(Math.max(1, dispatchProperties.getOfferTtlSeconds()));
        List<RideOffer> offers = new ArrayList<>(drivers.size());
        for (Driver driver : drivers) {
            offers.add(RideOffer.builder()
                    .tenantId(rideRequest.getTenantId())
                    .rideRequest(rideRequest)
                    .driver(driver)
                    .status(RideOfferStatus.OFFERED)
                    .expiresAt(expiry)
                    .build());
        }

        return rideOfferRepository.saveAll(offers);
    }

    @Override
    @Transactional
    public Optional<RideOffer> findAcceptableOffer(Long rideRequestId, Long driverId) {
        Optional<RideOffer> existing = rideOfferRepository
                .findTopByRideRequestIdAndDriverIdAndStatusOrderByOfferedAtDesc(
                        rideRequestId,
                        driverId,
                        RideOfferStatus.OFFERED
                );

        if (existing.isEmpty()) {
            return Optional.empty();
        }

        RideOffer offer = existing.get();
        if (offer.getExpiresAt() != null && offer.getExpiresAt().isBefore(UtcTimes.now())) {
            offer.setStatus(RideOfferStatus.EXPIRED);
            offer.setResolvedAt(UtcTimes.now());
            offer.setResolutionReason("Offer expired before acceptance.");
            rideOfferRepository.save(offer);
            return Optional.empty();
        }

        return Optional.of(offer);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasAnyOffer(Long rideRequestId) {
        return rideOfferRepository.existsByRideRequestId(rideRequestId);
    }

    @Override
    @Transactional
    public void markAccepted(RideOffer rideOffer) {
        rideOffer.setStatus(RideOfferStatus.ACCEPTED);
        rideOffer.setAcceptedAt(UtcTimes.now());
        rideOffer.setResolvedAt(UtcTimes.now());
        rideOffer.setResolutionReason("Accepted by driver.");
        rideOfferRepository.save(rideOffer);
    }

    @Override
    @Transactional
    public void markRevoked(RideOffer rideOffer, String reason) {
        rideOffer.setStatus(RideOfferStatus.REVOKED);
        rideOffer.setResolvedAt(UtcTimes.now());
        rideOffer.setResolutionReason(reason);
        rideOfferRepository.save(rideOffer);
    }

    @Override
    @Transactional
    public List<RideOffer> revokeCompetingOffers(Long rideRequestId, Long acceptedDriverId, String reason) {
        List<RideOffer> competing = rideOfferRepository.findByRideRequestIdAndStatusAndDriverIdNot(
                rideRequestId,
                RideOfferStatus.OFFERED,
                acceptedDriverId
        );

        if (competing.isEmpty()) {
            return List.of();
        }

        LocalDateTime now = UtcTimes.now();
        for (RideOffer offer : competing) {
            offer.setStatus(RideOfferStatus.REVOKED);
            offer.setResolvedAt(now);
            offer.setResolutionReason(reason);
        }

        List<RideOffer> saved = rideOfferRepository.saveAll(competing);
        for (RideOffer offer : saved) {
            if (offer.getDriver() == null || offer.getDriver().getUser() == null) {
                continue;
            }

            notificationService.createNotification(
                    offer.getDriver().getUser(),
                    "Ride no longer available",
                    "This ride request was accepted by another driver.",
                    NotificationType.RIDE_OFFER_REVOKED,
                    rideRequestId
            );
        }
        return saved;
    }

    @Override
    @Transactional
    public List<RideOffer> revokeOpenOffers(Long rideRequestId, String reason) {
        List<RideOffer> offered = rideOfferRepository.findByRideRequestIdAndStatus(
                rideRequestId,
                RideOfferStatus.OFFERED
        );
        if (offered.isEmpty()) {
            return List.of();
        }

        LocalDateTime now = UtcTimes.now();
        for (RideOffer offer : offered) {
            offer.setStatus(RideOfferStatus.REVOKED);
            offer.setResolvedAt(now);
            offer.setResolutionReason(reason);
        }

        List<RideOffer> saved = rideOfferRepository.saveAll(offered);
        for (RideOffer offer : saved) {
            if (offer.getDriver() == null || offer.getDriver().getUser() == null) {
                continue;
            }
            notificationService.createNotification(
                    offer.getDriver().getUser(),
                    "Ride request cancelled",
                    "The rider cancelled this ride request.",
                    NotificationType.RIDE_OFFER_REVOKED,
                    rideRequestId
            );
        }
        return saved;
    }

    @Override
    @Transactional
    public int expireStaleOffers() {
        LocalDateTime now = UtcTimes.now();
        List<RideOffer> staleOffers = rideOfferRepository.findByStatusAndExpiresAtLessThanEqual(RideOfferStatus.OFFERED, now);
        if (staleOffers.isEmpty()) {
            return 0;
        }

        Map<Long, RideRequest> rideRequestById = new LinkedHashMap<>();
        int expiredCount = 0;
        for (RideOffer offer : staleOffers) {
            int updated = rideOfferRepository.expireIfStillOffered(
                    offer.getId(), RideOfferStatus.OFFERED, RideOfferStatus.EXPIRED, now, "Offer timed out.");
            if (updated == 0) {
                continue;
            }
            expiredCount += updated;

            RideRequest rideRequest = offer.getRideRequest();
            if (rideRequest != null && rideRequest.getId() != null) {
                rideRequestById.putIfAbsent(rideRequest.getId(), rideRequest);
            }

            if (offer.getDriver() != null && offer.getDriver().getUser() != null) {
                notificationService.createNotification(
                        offer.getDriver().getUser(),
                        "Ride request expired",
                        "This ride request timed out before it was accepted.",
                        NotificationType.RIDE_EXPIRED,
                        offer.getRideRequest() == null ? null : offer.getRideRequest().getId()
                );
            }
        }

        for (RideRequest request : rideRequestById.values()) {
            int requestExpired = rideRequestRepository.expirePendingIfNoOpenOffers(
                    request.getId(), RideRequestStatus.PENDING, RideRequestStatus.EXPIRED,
                    RideOfferStatus.OFFERED, RideOfferStatus.ACCEPTED);
            if (requestExpired == 0) {
                continue;
            }

            entityManager.refresh(request);
            if (request.getRider() != null && request.getRider().getUser() != null) {
                notificationService.createNotification(
                        request.getRider().getUser(),
                        "No driver accepted in time",
                        "Your ride request expired. Please try requesting again.",
                        NotificationType.RIDE_EXPIRED,
                        request.getId()
                );
                rideRealtimeService.publishRideRequestPending(request);
            }
        }

        int skippedCount = staleOffers.size() - expiredCount;
        if (skippedCount > 0) {
            log.debug("Skipped {} stale ride offers changed concurrently", skippedCount);
        }
        if (expiredCount > 0) {
            log.info("Expired {} stale ride offers", expiredCount);
        }
        return expiredCount;
    }

    @Override
    @Transactional(readOnly = true)
    public long countOpenOffers() {
        return rideOfferRepository.countByStatus(RideOfferStatus.OFFERED);
    }

    @Override
    @Transactional(readOnly = true)
    public long countOpenOffers(Long tenantId) {
        return rideOfferRepository.countByTenantIdAndStatus(tenantId, RideOfferStatus.OFFERED);
    }

    @Override
    @Transactional(readOnly = true)
    public long countExpiredOffers() {
        return rideOfferRepository.countByStatus(RideOfferStatus.EXPIRED);
    }

    @Override
    @Transactional(readOnly = true)
    public long countExpiredOffers(Long tenantId) {
        return rideOfferRepository.countByTenantIdAndStatus(tenantId, RideOfferStatus.EXPIRED);
    }
}
