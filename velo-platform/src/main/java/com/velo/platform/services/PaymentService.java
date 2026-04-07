package com.velo.platform.services;

import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.enums.PaymentStatus;

public interface PaymentService {
    void processPayment(Ride ride);

    Payment createNewPayment(Ride ride);

    void updatePaymentStatus(Payment payment, PaymentStatus status);
}
