package com.velo.platform.repositories;

import com.velo.platform.entities.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    long countByCreatedTimeAfterAndCreatedTimeBefore(LocalDateTime start, LocalDateTime end);

    Page<User> findByTenantId(Long tenantId, Pageable pageable);

    long countByTenantId(Long tenantId);

    long countByTenantIdAndCreatedTimeAfterAndCreatedTimeBefore(Long tenantId, LocalDateTime start, LocalDateTime end);
}
