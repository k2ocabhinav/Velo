package com.velo.platform.dto;

import com.velo.platform.entities.enums.PayoutStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PayoutRequestDto {
    private Long id;
    private BigDecimal amount;
    private PayoutStatus status;
    private LocalDateTime requestedAt;
    private LocalDateTime processedAt;
    private String adminNote;
}
