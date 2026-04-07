package com.velo.platform.services.impl;

import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.enums.PaymentStatus;
import com.velo.platform.events.PaymentProcessedEvent;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.PaymentRepository;
import com.velo.platform.services.PaymentService;
import com.velo.platform.strategies.PaymentStrategyManager;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {
    private final PaymentRepository paymentRepository;
    private final PaymentStrategyManager paymentStrategyManager;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public void processPayment(Ride ride) {
        Payment payment = paymentRepository.findByRide(ride)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found for ride with id: "+ride.getId()));
        paymentStrategyManager.paymentStrategy(payment.getPaymentMethod()).processPayment(payment);

        eventPublisher.publishEvent(new PaymentProcessedEvent(this, payment));
    }

    @Override
    @Transactional
    public Payment createNewPayment(Ride ride) {
        Payment payment = Payment.builder()
                .ride(ride)
                .paymentMethod(ride.getPaymentMethod())
                .amount(ride.getFare())
                .paymentStatus(PaymentStatus.PENDING)
                .build();
        return paymentRepository.save(payment);
    }

    @Override
    @Transactional
    public void updatePaymentStatus(Payment payment, PaymentStatus status) {
        payment.setPaymentStatus(status);
        paymentRepository.save(payment);
    }
}
