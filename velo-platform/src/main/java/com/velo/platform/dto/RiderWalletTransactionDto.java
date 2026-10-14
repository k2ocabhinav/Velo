package com.velo.platform.dto;

import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.entities.enums.TransactionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiderWalletTransactionDto {
    private Long id;
    private TransactionType type;
    private BigDecimal amount;
    private TransactionMethod method;
    private Long rideReference;
    private LocalDateTime timestamp;
}
