package com.velo.platform.repositories;

import com.velo.platform.entities.PromoCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PromoCodeRepository extends JpaRepository<PromoCode, Long> {
    boolean existsByCode(String code);
    java.util.Optional<PromoCode> findByCodeAndTenantId(String code, Long tenantId);
    java.util.Optional<PromoCode> findByIdAndTenantId(Long id, Long tenantId);
    java.util.List<PromoCode> findByTenantIdAndActiveTrue(Long tenantId);
    java.util.List<PromoCode> findByTenantId(Long tenantId);

    @Modifying(flushAutomatically = true)
    @Query("""
            UPDATE PromoCode p
            SET p.currentUses = COALESCE(p.currentUses, 0) + 1
            WHERE p.id = :promoCodeId
              AND p.tenantId = :tenantId
              AND p.active = true
              AND (p.maxUses IS NULL OR COALESCE(p.currentUses, 0) < p.maxUses)
            """)
    int incrementCurrentUsesIfAvailable(@Param("promoCodeId") Long promoCodeId,
                                        @Param("tenantId") Long tenantId);
}
