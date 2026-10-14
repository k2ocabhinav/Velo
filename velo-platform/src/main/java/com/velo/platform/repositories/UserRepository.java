package com.velo.platform.repositories;

import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    long countByCreatedTimeAfterAndCreatedTimeBefore(LocalDateTime start, LocalDateTime end);

    Page<User> findByTenantId(Long tenantId, Pageable pageable);

    Optional<User> findByIdAndTenantId(Long id, Long tenantId);

    long countByTenantId(Long tenantId);

    long countByTenantIdAndCreatedTimeAfterAndCreatedTimeBefore(Long tenantId, LocalDateTime start, LocalDateTime end);

    @Query("select distinct u from User u join u.roles role where u.tenantId = :tenantId and role = :role")
    java.util.List<User> findTenantUsersByRole(@Param("tenantId") Long tenantId, @Param("role") Role role);
}
