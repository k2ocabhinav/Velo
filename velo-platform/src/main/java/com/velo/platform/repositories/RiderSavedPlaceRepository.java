package com.velo.platform.repositories;

import com.velo.platform.entities.RiderSavedPlace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RiderSavedPlaceRepository extends JpaRepository<RiderSavedPlace, Long> {
    List<RiderSavedPlace> findAllByTenantIdAndUserIdOrderByCreatedAtDescIdDesc(Long tenantId, Long userId);

    Optional<RiderSavedPlace> findByIdAndTenantIdAndUserId(Long id, Long tenantId, Long userId);
}
