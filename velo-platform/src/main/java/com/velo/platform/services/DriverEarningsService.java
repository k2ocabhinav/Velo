package com.velo.platform.services;

import com.velo.platform.dto.DriverEarningDto;
import com.velo.platform.dto.EarningsSummaryDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface DriverEarningsService {
    void createEarningRecord(Ride ride);
    Page<DriverEarningDto> getEarningsHistory(PageRequest pageRequest);
    EarningsSummaryDto getDailySummary(LocalDate date);
    EarningsSummaryDto getWeeklySummary(LocalDate date);
    EarningsSummaryDto getMonthlySummary(LocalDate date);
    BigDecimal getAvailableBalance();

    /** Available balance for an already-resolved driver, so callers lock the driver row just once. */
    BigDecimal getAvailableBalance(Driver driver);
}
