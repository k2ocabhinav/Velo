package com.velo.platform.repositories;

import com.velo.platform.entities.Rider;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RiderRepository extends JpaRepository<Rider, Long> {

    @Query("select r from Rider r where r.user.id = :userId")
    Optional<Rider> findByUserId(@Param("userId") Long userId);

    @Query("select r from Rider r where r.user.id = :userId and r.tenantId = :tenantId")
    Optional<Rider> findByUserIdAndTenantId(@Param("userId") Long userId, @Param("tenantId") Long tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Rider r where r.user.id = :userId and r.tenantId = :tenantId")
    Optional<Rider> findByUserIdAndTenantIdForUpdate(@Param("userId") Long userId, @Param("tenantId") Long tenantId);

    long countByTenantId(Long tenantId);
}
