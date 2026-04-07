package com.velo.platform.events;

import com.velo.platform.entities.Payment;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class PaymentProcessedEvent extends ApplicationEvent {

    private final Payment payment;

    public PaymentProcessedEvent(Object source, Payment payment) {
        super(source);
        this.payment = payment;
    }
}
