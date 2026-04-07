package com.velo.platform.repositories;

import com.velo.platform.entities.Driver;
import org.locationtech.jts.geom.Point;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {

    @Query("select d from Driver d where d.user.id = :userId")
    Optional<Driver> findByUserId(@Param("userId") Long userId);

    /*
     * Use geography so SRID 4326 distances are measured in meters.
     * */
    @Query(value = "SELECT d.*, ST_Distance(d.current_location::geography, :pickupLocation::geography) AS distance " +
            "FROM driver AS d " +
            "WHERE d.available = true AND ST_DWithin(d.current_location::geography, :pickupLocation::geography, 10000) " +
            "ORDER BY distance " +
            "LIMIT 10",
            nativeQuery = true
    )
    List<Driver> findTenNearestDrivers(@Param("pickupLocation") Point pickupLocation);

    @Query(value = "SELECT d.* " +
            "FROM driver d " +
            "WHERE d.available = true AND ST_DWithin(d.current_location::geography, :pickupLocation::geography, 15000) " +
            "ORDER BY d.rating DESC " +
            "LIMIT 10", nativeQuery = true)
    List<Driver> findTenNearbyTopRatedDrivers(@Param("pickupLocation") Point pickupLocation);
}
