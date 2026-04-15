package com.velo.platform.repositories;

import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.enums.RideOfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RideOfferRepository extends JpaRepository<RideOffer, Long> {

    Optional<RideOffer> findTopByRideRequestIdAndDriverIdAndStatusOrderByOfferedAtDesc(
            Long rideRequestId,
            Long driverId,
            RideOfferStatus status
    );

    List<RideOffer> findByRideRequestIdAndStatusAndDriverIdNot(
            Long rideRequestId,
            RideOfferStatus status,
            Long driverId
    );

    List<RideOffer> findByRideRequestIdOrderByOfferedAtDesc(Long rideRequestId);

    List<RideOffer> findByStatusAndExpiresAtLessThanEqual(RideOfferStatus status, LocalDateTime cutoff);

    boolean existsByRideRequestId(Long rideRequestId);

    boolean existsByRideRequestIdAndStatus(Long rideRequestId, RideOfferStatus status);

    long countByRideRequestIdAndStatus(Long rideRequestId, RideOfferStatus status);

    long countByStatus(RideOfferStatus status);

    long countByTenantIdAndStatus(Long tenantId, RideOfferStatus status);
}
