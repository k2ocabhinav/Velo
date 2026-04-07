package com.velo.platform.repositories;

import com.velo.platform.entities.Rider;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RiderRepository extends JpaRepository<Rider, Long> {

    @Query("select r from Rider r where r.user.id = :userId")
    Optional<Rider> findByUserId(@Param("userId") Long userId);
}
