package com.velo.platform.services;

import com.velo.platform.entities.Ride;
import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.enums.TransactionMethod;

import java.math.BigDecimal;

public interface WalletService {
    Wallet addMoneyToWallet(User user, BigDecimal amount,
                            String transactionId, Ride ride,
                            TransactionMethod transactionMethod);

    Wallet deductMoneyFromWallet(User user, BigDecimal amount,
                                 String transactionId, Ride ride,
                                 TransactionMethod transactionMethod);

    void withdrawAllMyMoneyFromWallet(User user);

    Wallet findWalletById(Long walletId);

    Wallet createNewWallet(User user);

    Wallet findByUser(User user);
}
