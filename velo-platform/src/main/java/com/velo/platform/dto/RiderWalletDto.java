package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiderWalletDto {
    private BigDecimal balance;
    private String currency;
    private Page<RiderWalletTransactionDto> transactions;
}
