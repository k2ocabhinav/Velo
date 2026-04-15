package com.velo.platform.repositories;

import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.enums.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByRide(Ride ride);
    List<Payment> findByPaymentStatus(PaymentStatus paymentStatus);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.paymentStatus = :paymentStatus")
    BigDecimal sumAmountByPaymentStatus(@Param("paymentStatus") PaymentStatus paymentStatus);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.tenantId = :tenantId and p.paymentStatus = :paymentStatus")
    BigDecimal sumAmountByTenantIdAndPaymentStatus(
            @Param("tenantId") Long tenantId,
            @Param("paymentStatus") PaymentStatus paymentStatus
    );
}
