package com.velo.platform.strategies;

import com.velo.platform.entities.Payment;

public interface PaymentStrategy {
    void processPayment(Payment payment);
}
