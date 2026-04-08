package com.velo.platform.repositories;

import com.velo.platform.entities.Rider;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.enums.RideRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RideRequestRepository extends JpaRepository<RideRequest, Long> {
    List<RideRequest> findByRideRequestStatus(RideRequestStatus rideRequestStatus);

    long countByRideRequestStatus(RideRequestStatus rideRequestStatus);

    Page<RideRequest> findByRiderAndRideRequestStatusOrderByScheduledTimeAsc(
            Rider rider, RideRequestStatus status, Pageable pageable);

    Page<RideRequest> findByRideRequestStatusOrderByScheduledTimeAsc(
            RideRequestStatus status, Pageable pageable);

    @Query("SELECT r FROM RideRequest r WHERE r.rideRequestStatus = :status " +
            "AND r.scheduledTime <= :dispatchBefore ORDER BY r.scheduledTime ASC")
    List<RideRequest> findDueScheduledRides(
            @Param("status") RideRequestStatus status,
            @Param("dispatchBefore") LocalDateTime dispatchBefore);

    Optional<RideRequest> findTopByRiderAndRideRequestStatusInOrderByRequestedTimeDesc(
            Rider rider,
            List<RideRequestStatus> statuses
    );
}
