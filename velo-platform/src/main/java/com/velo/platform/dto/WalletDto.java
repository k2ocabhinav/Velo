package com.velo.platform.dto;

import java.util.List;

public class WalletDto {

    private Long id;

    private UserDto user;

    private Double balance;

    private List<WalletTransactionDto> transactions;
}
