package com.velo.platform.repositories;

import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.enums.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByRide(Ride ride);
    List<Payment> findByPaymentStatus(PaymentStatus paymentStatus);
}
