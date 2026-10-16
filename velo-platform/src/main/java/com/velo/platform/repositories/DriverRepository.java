package com.velo.platform.repositories;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import jakarta.persistence.LockModeType;
import org.locationtech.jts.geom.Point;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {

    @Query("select d from Driver d where d.user.id = :userId")
    Optional<Driver> findByUserId(@Param("userId") Long userId);

    @Query("select d from Driver d where d.user.id = :userId and d.tenantId = :tenantId")
    Optional<Driver> findByUserIdAndTenantId(@Param("userId") Long userId, @Param("tenantId") Long tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Driver d where d.user.id = :userId and d.tenantId = :tenantId")
    Optional<Driver> findByUserIdAndTenantIdForUpdate(@Param("userId") Long userId, @Param("tenantId") Long tenantId);

    long countByAvailableTrue();
    long countByTenantId(Long tenantId);
    long countByTenantIdAndAvailableTrue(Long tenantId);

    long countByOnboardingStatus(DriverOnboardingStatus onboardingStatus);

    Page<Driver> findByTenantIdAndOnboardingStatusOrderByCreatedAtDesc(
            Long tenantId,
            DriverOnboardingStatus onboardingStatus,
            Pageable pageable
    );

    Page<Driver> findByOnboardingStatusOrderByCreatedAtDesc(
            DriverOnboardingStatus onboardingStatus,
            Pageable pageable
    );

    long countByTenantIdAndOnboardingStatus(Long tenantId, DriverOnboardingStatus onboardingStatus);

    /*
     * Use geography so SRID 4326 distances are measured in meters.
     * */
    @Query(value = "SELECT d.*, ST_Distance(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography)) AS distance " +
            "FROM driver AS d " +
            "JOIN app_user u ON u.id = d.user_id " +
            "WHERE d.tenant_id = :tenantId " +
            "AND u.simulated = :simulated " +
            "AND d.available = true AND d.onboarding_status = 'APPROVED' AND d.current_location IS NOT NULL " +
            "AND ST_DWithin(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography), 10000) " +
            "ORDER BY distance, d.id " +
            "LIMIT 10",
            nativeQuery = true
    )
    List<Driver> findTenNearestDrivers(
            @Param("pickupLocation") Point pickupLocation,
            @Param("tenantId") Long tenantId,
            @Param("simulated") boolean simulated
    );

    @Query(value = "SELECT d.* " +
            "FROM driver d " +
            "JOIN app_user u ON u.id = d.user_id " +
            "WHERE d.tenant_id = :tenantId " +
            "AND u.simulated = :simulated " +
            "AND d.available = true AND d.onboarding_status = 'APPROVED' AND d.current_location IS NOT NULL " +
            "AND ST_DWithin(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography), 15000) " +
            "ORDER BY d.rating DESC, ST_Distance(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography)), d.id " +
            "LIMIT 10", nativeQuery = true)
    List<Driver> findTenNearbyTopRatedDrivers(
            @Param("pickupLocation") Point pickupLocation,
            @Param("tenantId") Long tenantId,
            @Param("simulated") boolean simulated
    );

    @Query(
            "select d from Driver d " +
            "where d.tenantId = :tenantId " +
            "and d.available = true " +
            "and d.user.simulated = :simulated " +
            "and d.onboardingStatus = :onboardingStatus " +
            "order by d.rating desc, d.createdAt desc, d.id desc"
    )
    List<Driver> findAvailableDriversForFallback(
            @Param("tenantId") Long tenantId,
            @Param("simulated") boolean simulated,
            @Param("onboardingStatus") DriverOnboardingStatus onboardingStatus,
            Pageable pageable
    );

    default List<Driver> findTenNearestDrivers(Point pickupLocation) {
        return findTenNearestDrivers(pickupLocation, 1L, false);
    }

    default List<Driver> findTenNearestDrivers(Point pickupLocation, Long tenantId) {
        return findTenNearestDrivers(pickupLocation, tenantId, false);
    }

    default List<Driver> findTenNearbyTopRatedDrivers(Point pickupLocation) {
        return findTenNearbyTopRatedDrivers(pickupLocation, 1L, false);
    }

    default List<Driver> findTenNearbyTopRatedDrivers(Point pickupLocation, Long tenantId) {
        return findTenNearbyTopRatedDrivers(pickupLocation, tenantId, false);
    }

    default List<Driver> findFallbackDrivers(Long tenantId, int limit) {
        return findFallbackDrivers(tenantId, limit, false);
    }

    default List<Driver> findFallbackDrivers(Long tenantId, int limit, boolean simulated) {
        return findAvailableDriversForFallback(
                tenantId,
                simulated,
                DriverOnboardingStatus.APPROVED,
                PageRequest.of(0, limit)
        );
    }

    @Modifying(flushAutomatically = true)
    @Query("update Driver d set d.available = :available where d.id = :driverId")
    int updateAvailabilityById(@Param("driverId") Long driverId, @Param("available") boolean available);
}
