package com.velo.platform.dto;

import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.entities.enums.TransactionType;

import java.time.LocalDateTime;

public class WalletTransactionDto {
    private Long id;

    private Double amount;

    private TransactionType transactionType;

    private TransactionMethod transactionMethod;

    private RideDto ride;

    private String transactionId;

    private WalletDto wallet;

    private LocalDateTime timeStamp;
}
