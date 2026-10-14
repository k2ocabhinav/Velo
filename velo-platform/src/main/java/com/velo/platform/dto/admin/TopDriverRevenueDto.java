package com.velo.platform.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopDriverRevenueDto {
    private Long driverId;
    private String driverName;
    private Long trips;
    private BigDecimal gross;
    private BigDecimal commission;
    private BigDecimal net;
}
