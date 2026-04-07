package com.velo.platform.strategies;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.strategies.impl.CashPaymentStrategy;
import com.velo.platform.strategies.impl.WalletPaymentStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PaymentStrategyManager {

    private final WalletPaymentStrategy walletPaymentStrategy;
    private final CashPaymentStrategy cashPaymentStrategy;

    public PaymentStrategy paymentStrategy(PaymentMethod paymentMethod) {
        return switch (paymentMethod) {
            case WALLET -> walletPaymentStrategy;
            case CASH -> cashPaymentStrategy;
            default -> throw new RuntimeConflictException("Unsupported payment method: " + paymentMethod);
        };
    }
}
