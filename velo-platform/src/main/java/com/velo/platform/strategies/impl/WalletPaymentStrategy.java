package com.velo.platform.strategies.impl;

import com.velo.platform.configs.PlatformConfig;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.enums.PaymentStatus;
import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.repositories.PaymentRepository;
import com.velo.platform.services.WalletService;
import com.velo.platform.strategies.PaymentStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;


@Service
@RequiredArgsConstructor
public class WalletPaymentStrategy implements PaymentStrategy {

    private final WalletService walletService;
    private final PaymentRepository paymentRepository;
    private final PlatformConfig platformConfig;

    @Override
    @Transactional
    public void processPayment(Payment payment) {
        Driver driver = payment.getRide().getDriver();
        Rider rider = payment.getRide().getRider();

        walletService.deductMoneyFromWallet(rider.getUser(),
                payment.getAmount(), null, payment.getRide(), TransactionMethod.RIDE);

        BigDecimal driversCut = payment.getAmount().multiply(BigDecimal.ONE.subtract(BigDecimal.valueOf(platformConfig.getCommissionRate())));

        walletService.addMoneyToWallet(driver.getUser(),
                driversCut, null, payment.getRide(), TransactionMethod.RIDE);

        payment.setPaymentStatus(PaymentStatus.CONFIRMED);
        paymentRepository.save(payment);
    }
}
