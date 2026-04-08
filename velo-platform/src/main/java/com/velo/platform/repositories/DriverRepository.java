package com.velo.platform.repositories;

import com.velo.platform.entities.Driver;
import org.locationtech.jts.geom.Point;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {

    @Query("select d from Driver d where d.user.id = :userId")
    Optional<Driver> findByUserId(@Param("userId") Long userId);

    long countByAvailableTrue();

    @Query("select count(d) from Driver d where d.rating is null or d.rating < :approvalThreshold")
    long countPendingDriverApprovals(@Param("approvalThreshold") Double approvalThreshold);

    @Query("select d from Driver d where d.rating is null or d.rating < :approvalThreshold")
    Page<Driver> findPendingDriverApprovals(@Param("approvalThreshold") Double approvalThreshold, Pageable pageable);

    /*
     * Use geography so SRID 4326 distances are measured in meters.
     * */
    @Query(value = "SELECT d.*, ST_Distance(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography)) AS distance " +
            "FROM driver AS d " +
            "WHERE d.available = true AND d.current_location IS NOT NULL " +
            "AND ST_DWithin(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography), 10000) " +
            "ORDER BY distance " +
            "LIMIT 10",
            nativeQuery = true
    )
    List<Driver> findTenNearestDrivers(@Param("pickupLocation") Point pickupLocation);

    @Query(value = "SELECT d.* " +
            "FROM driver d " +
            "WHERE d.available = true AND d.current_location IS NOT NULL " +
            "AND ST_DWithin(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography), 15000) " +
            "ORDER BY d.rating DESC, ST_Distance(CAST(d.current_location AS geography), CAST(:pickupLocation AS geography)) " +
            "LIMIT 10", nativeQuery = true)
    List<Driver> findTenNearbyTopRatedDrivers(@Param("pickupLocation") Point pickupLocation);

    @Modifying(flushAutomatically = true)
    @Query("update Driver d set d.available = :available where d.id = :driverId")
    int updateAvailabilityById(@Param("driverId") Long driverId, @Param("available") boolean available);
}
