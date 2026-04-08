package com.velo.platform.repositories;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.RideStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RideRepository extends JpaRepository<Ride, Long> {
    Page<Ride> findByRider(Rider rider, Pageable pageRequest);

    Page<Ride> findByDriver(Driver driver, Pageable pageRequest);

    List<Ride> findByDriverAndRideStatusIn(Driver driver, List<RideStatus> rideStatuses);

    Optional<Ride> findTopByRiderAndRideStatusInOrderByCreatedTimeDesc(Rider rider, List<RideStatus> rideStatuses);

    Optional<Ride> findTopByDriverAndRideStatusInOrderByCreatedTimeDesc(Driver driver, List<RideStatus> rideStatuses);

    long countByRideStatus(RideStatus rideStatus);

    long countByCreatedTimeAfterAndCreatedTimeBefore(LocalDateTime start, LocalDateTime end);

    long countByCreatedTimeAfterAndCreatedTimeBeforeAndRideStatus(LocalDateTime start,
                                                                  LocalDateTime end,
                                                                  RideStatus rideStatus);

    @Query("select coalesce(sum(r.fare), 0) from Ride r where r.createdTime > :start and r.createdTime < :end")
    BigDecimal sumFareByCreatedTimeAfterAndCreatedTimeBefore(@Param("start") LocalDateTime start,
                                                             @Param("end") LocalDateTime end);
}
