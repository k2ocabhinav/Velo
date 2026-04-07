package com.velo.platform.repositories;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.RideStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RideRepository extends JpaRepository<Ride, Long> {
    Page<Ride> findByRider(Rider rider, Pageable pageRequest);

    Page<Ride> findByDriver(Driver driver, Pageable pageRequest);

    long countByRideStatus(RideStatus rideStatus);
}
