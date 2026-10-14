package com.velo.platform.repositories;

import com.velo.platform.entities.RecurringTripTemplate;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecurringTripTemplateRepository extends JpaRepository<RecurringTripTemplate, Long> {
    @EntityGraph(attributePaths = {"rider.user"})
    Page<RecurringTripTemplate> findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, Pageable pageable);

    @EntityGraph(attributePaths = {"rider.user"})
    Page<RecurringTripTemplate> findByTenantIdAndRider_IdAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, Long riderId, Pageable pageable);

    List<RecurringTripTemplate> findByTenantIdAndActiveTrueAndDeletedFalse(Long tenantId);

    Optional<RecurringTripTemplate> findByIdAndTenantId(Long id, Long tenantId);

    Optional<RecurringTripTemplate> findByIdAndTenantIdAndRider_Id(Long id, Long tenantId, Long riderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RecurringTripTemplate t where t.id = :id and t.tenantId = :tenantId")
    Optional<RecurringTripTemplate> findByIdAndTenantIdForUpdate(@Param("id") Long id, @Param("tenantId") Long tenantId);
}
