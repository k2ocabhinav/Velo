package com.velo.platform.repositories;

import com.velo.platform.entities.AdminDispatchAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminDispatchAuditRepository extends JpaRepository<AdminDispatchAudit, Long> {

    Page<AdminDispatchAudit> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
