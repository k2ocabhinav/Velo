package com.velo.platform.repositories;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.PayoutRequest;
import com.velo.platform.entities.enums.PayoutStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PayoutRequestRepository extends JpaRepository<PayoutRequest, Long> {
    Page<PayoutRequest> findByDriverOrderByRequestedAtDesc(Driver driver, Pageable pageable);

    Page<PayoutRequest> findByStatusOrderByRequestedAtAsc(PayoutStatus status, Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM PayoutRequest p WHERE p.driver = :driver AND p.status IN :statuses")
    BigDecimal getTotalPayoutsByDriverAndStatuses(@Param("driver") Driver driver,
                                                  @Param("statuses") List<PayoutStatus> statuses);
}
