package com.velo.platform.repositories;

import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.enums.RideOfferStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    List<RideOffer> findByRideRequestIdAndStatus(Long rideRequestId, RideOfferStatus status);

    List<RideOffer> findByRideRequestIdOrderByOfferedAtDesc(Long rideRequestId);

    @EntityGraph(attributePaths = {"driver.user"})
    List<RideOffer> findByRideRequestIdAndTenantIdOrderByOfferedAtDesc(Long rideRequestId, Long tenantId);

    List<RideOffer> findByStatusAndExpiresAtLessThanEqual(RideOfferStatus status, LocalDateTime cutoff);

    boolean existsByRideRequestId(Long rideRequestId);

    boolean existsByRideRequestIdAndStatus(Long rideRequestId, RideOfferStatus status);

    long countByRideRequestIdAndStatus(Long rideRequestId, RideOfferStatus status);

    @Query("""
            select offer.rideRequest.id as rideRequestId, count(offer.id) as offerCount
            from RideOffer offer
            where offer.rideRequest.id in :rideRequestIds
              and offer.status = :status
            group by offer.rideRequest.id
            """)
    List<OfferCountProjection> countOffersByRideRequestIdsAndStatus(
            @Param("rideRequestIds") List<Long> rideRequestIds,
            @Param("status") RideOfferStatus status
    );

    long countByStatus(RideOfferStatus status);

    long countByTenantIdAndStatus(Long tenantId, RideOfferStatus status);

    interface OfferCountProjection {
        Long getRideRequestId();
        Long getOfferCount();
    }
}
