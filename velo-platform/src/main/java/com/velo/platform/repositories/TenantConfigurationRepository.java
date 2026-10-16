package com.velo.platform.repositories;

import com.velo.platform.entities.TenantConfiguration;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantConfigurationRepository extends JpaRepository<TenantConfiguration, Long> {
    Optional<TenantConfiguration> findByTenant_Id(Long tenantId);

    @EntityGraph(attributePaths = "tenant")
    Optional<TenantConfiguration> findWithTenantByTenant_Id(Long tenantId);
}
