package com.velo.platform.strategies.impl;

import com.velo.platform.configs.PlatformConfig;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Payment;
import com.velo.platform.entities.enums.PaymentStatus;
import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.repositories.PaymentRepository;
import com.velo.platform.services.WalletService;
import com.velo.platform.strategies.PaymentStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class CashPaymentStrategy implements PaymentStrategy {

    private final WalletService walletService;
    private final PaymentRepository paymentRepository;
    private final PlatformConfig platformConfig;

    @Override
    public void processPayment(Payment payment) {
        Driver driver = payment.getRide().getDriver();

        BigDecimal platformCommission = payment.getAmount().multiply(BigDecimal.valueOf(platformConfig.getCommissionRate()));

        walletService.deductMoneyFromWallet(driver.getUser(), platformCommission, null,
                payment.getRide(), TransactionMethod.RIDE);

        payment.setPaymentStatus(PaymentStatus.CONFIRMED);
        paymentRepository.save(payment);
    }
}