package com.velo.platform.services.impl;

import com.velo.platform.configs.PlatformConfig;
import com.velo.platform.dto.DriverEarningDto;
import com.velo.platform.dto.EarningsSummaryDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.DriverEarning;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.enums.PayoutStatus;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.DriverEarningRepository;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.PayoutRequestRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.DriverEarningsService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class DriverEarningsServiceImpl implements DriverEarningsService {

    private final DriverEarningRepository driverEarningRepository;
    private final DriverRepository driverRepository;
    private final PayoutRequestRepository payoutRequestRepository;
    private final PlatformConfig platformConfig;
    private final ModelMapper modelMapper;

    @Override
    @Transactional
    public void createEarningRecord(Ride ride) {
        BigDecimal grossFare = ride.getFare();
        BigDecimal platformCommission = grossFare.multiply(BigDecimal.valueOf(platformConfig.getCommissionRate()));
        BigDecimal netEarning = grossFare.subtract(platformCommission);

        DriverEarning earning = DriverEarning.builder()
                .driver(ride.getDriver())
                .ride(ride)
                .grossFare(grossFare)
                .platformCommission(platformCommission)
                .netEarning(netEarning)
                .build();

        driverEarningRepository.save(earning);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DriverEarningDto> getEarningsHistory(PageRequest pageRequest) {
        Driver driver = getCurrentDriver();
        return driverEarningRepository.findByDriverOrderByCreatedTimeDesc(driver, pageRequest)
                .map(earning -> {
                    DriverEarningDto dto = modelMapper.map(earning, DriverEarningDto.class);
                    dto.setRideId(earning.getRide().getId());
                    return dto;
                });
    }

    @Override
    @Transactional(readOnly = true)
    public EarningsSummaryDto getDailySummary(LocalDate date) {
        Driver driver = getCurrentDriver();
        LocalDateTime startDate = date.atStartOfDay();
        LocalDateTime endDate = date.plusDays(1).atStartOfDay();
        EarningsSummaryDto summary = driverEarningRepository.getEarningsSummary(driver, startDate, endDate);
        if (summary == null || summary.getRideCount() == 0) {
            summary = new EarningsSummaryDto(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0L, null, startDate, endDate);
        }
        summary.setPeriod("DAILY");
        summary.setStartDate(startDate);
        summary.setEndDate(endDate);
        return summary;
    }

    @Override
    @Transactional(readOnly = true)
    public EarningsSummaryDto getWeeklySummary(LocalDate date) {
        Driver driver = getCurrentDriver();
        LocalDate startOfWeek = date.minusDays(date.getDayOfWeek().getValue() - 1);
        LocalDateTime startDate = startOfWeek.atStartOfDay();
        LocalDateTime endDate = startOfWeek.plusWeeks(1).atStartOfDay();
        EarningsSummaryDto summary = driverEarningRepository.getEarningsSummary(driver, startDate, endDate);
        if (summary == null || summary.getRideCount() == 0) {
            summary = new EarningsSummaryDto(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0L, null, startDate, endDate);
        }
        summary.setPeriod("WEEKLY");
        summary.setStartDate(startDate);
        summary.setEndDate(endDate);
        return summary;
    }

    @Override
    @Transactional(readOnly = true)
    public EarningsSummaryDto getMonthlySummary(LocalDate date) {
        Driver driver = getCurrentDriver();
        LocalDate startOfMonth = date.withDayOfMonth(1);
        LocalDateTime startDate = startOfMonth.atStartOfDay();
        LocalDateTime endDate = startOfMonth.plusMonths(1).atStartOfDay();
        EarningsSummaryDto summary = driverEarningRepository.getEarningsSummary(driver, startDate, endDate);
        if (summary == null || summary.getRideCount() == 0) {
            summary = new EarningsSummaryDto(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0L, null, startDate, endDate);
        }
        summary.setPeriod("MONTHLY");
        summary.setStartDate(startDate);
        summary.setEndDate(endDate);
        return summary;
    }
    
    @Override
    @Transactional(readOnly = true)
    public BigDecimal getAvailableBalance() {
        Driver driver = getCurrentDriver();
        BigDecimal totalNet = driverEarningRepository.getTotalNetEarningsByDriver(driver);
        if (totalNet == null) totalNet = BigDecimal.ZERO;
        
        BigDecimal pendingAndProcessedPayouts = payoutRequestRepository.getTotalPayoutsByDriverAndStatuses(
            driver, java.util.List.of(PayoutStatus.PENDING, PayoutStatus.APPROVED, PayoutStatus.PROCESSED));
        if (pendingAndProcessedPayouts == null) pendingAndProcessedPayouts = BigDecimal.ZERO;
        
        BigDecimal balance = totalNet.subtract(pendingAndProcessedPayouts);
        return balance.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : balance;
    }

    private Driver getCurrentDriver() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return driverRepository.findByUserId(principal.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Driver profile not found"));
    }
}
