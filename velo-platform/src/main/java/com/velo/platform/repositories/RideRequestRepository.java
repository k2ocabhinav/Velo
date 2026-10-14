package com.velo.platform.repositories;

import com.velo.platform.entities.Rider;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.enums.RideRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
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

    Page<RideRequest> findByTenantIdAndRideRequestStatusOrderByScheduledTimeAsc(
            Long tenantId, RideRequestStatus status, Pageable pageable);

    Page<RideRequest> findByRideRequestStatusOrderByRequestedTimeDesc(
            RideRequestStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"rider.user"})
    Page<RideRequest> findByTenantIdAndRideRequestStatusOrderByRequestedTimeDesc(
            Long tenantId,
            RideRequestStatus status,
            Pageable pageable
    );

    @Query("SELECT r.id FROM RideRequest r WHERE r.rideRequestStatus = :status " +
            "AND r.scheduledTime <= :dispatchBefore ORDER BY r.scheduledTime ASC")
    List<Long> findDueScheduledRideIds(
            @Param("status") RideRequestStatus status,
            @Param("dispatchBefore") LocalDateTime dispatchBefore);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RideRequest r WHERE r.id = :id AND r.rideRequestStatus = :status")
    Optional<RideRequest> findByIdAndRideRequestStatusForUpdate(
            @Param("id") Long id, @Param("status") RideRequestStatus status);

    Optional<RideRequest> findByIdAndTenantIdAndRider_Id(Long id, Long tenantId, Long riderId);

    Optional<RideRequest> findTopByRiderAndRideRequestStatusInOrderByRequestedTimeDesc(
            Rider rider,
            List<RideRequestStatus> statuses
    );

    Optional<RideRequest> findTopByRiderAndTenantIdAndRideRequestStatusInOrderByRequestedTimeDesc(
            Rider rider,
            Long tenantId,
            List<RideRequestStatus> statuses
    );

    Optional<RideRequest> findTopByRiderAndTenantIdAndRideRequestStatusOrderByRequestedTimeDesc(
            Rider rider, Long tenantId, RideRequestStatus status);

    Page<RideRequest> findByTenantIdAndRiderAndRideRequestStatusOrderByScheduledTimeAsc(
            Long tenantId, Rider rider, RideRequestStatus status, Pageable pageable);

    boolean existsByRiderAndTenantIdAndRideRequestStatusIn(
            Rider rider,
            Long tenantId,
            List<RideRequestStatus> statuses
    );

    Optional<RideRequest> findTopByRiderAndRideRequestStatusOrderByRequestedTimeDesc(
            Rider rider,
            RideRequestStatus status
    );

    long countByTenantIdAndRideRequestStatus(Long tenantId, RideRequestStatus rideRequestStatus);

    @EntityGraph(attributePaths = {"rider.user", "ride.driver.user", "recurringTemplate"})
    List<RideRequest> findByTenantIdAndScheduledTimeGreaterThanEqualAndScheduledTimeLessThanOrderByScheduledTimeAsc(
            Long tenantId, LocalDateTime start, LocalDateTime end);

    @EntityGraph(attributePaths = {"rider.user", "ride.driver.user", "recurringTemplate"})
    List<RideRequest> findByTenantIdAndRideRequestStatusInAndScheduledTimeBetweenOrderByScheduledTimeAsc(
            Long tenantId, List<RideRequestStatus> statuses, LocalDateTime start, LocalDateTime end);

    @EntityGraph(attributePaths = {"rider.user"})
    List<RideRequest> findByTenantIdAndRecurringTemplate_IdAndRideRequestStatusAndScheduledTimeAfter(
            Long tenantId, Long templateId, RideRequestStatus status, LocalDateTime after);

    boolean existsByTenantIdAndRecurringTemplate_IdAndOccurrenceDate(Long tenantId, Long templateId, java.time.LocalDate date);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RideRequest r WHERE r.id = :id AND r.tenantId = :tenantId")
    Optional<RideRequest> findByIdAndTenantIdForUpdate(@Param("id") Long id, @Param("tenantId") Long tenantId);

    @Modifying(flushAutomatically = true)
    @Query("""
            update RideRequest r
            set r.rideRequestStatus = :nextStatus
            where r.id = :rideRequestId
              and r.tenantId = :tenantId
              and r.rideRequestStatus = :expectedStatus
            """)
    int compareAndSetStatus(
            @Param("rideRequestId") Long rideRequestId,
            @Param("tenantId") Long tenantId,
            @Param("expectedStatus") RideRequestStatus expectedStatus,
            @Param("nextStatus") RideRequestStatus nextStatus
    );
}
