package com.velo.platform.controllers;

import com.velo.platform.dto.DriverEarningDto;
import com.velo.platform.dto.EarningsSummaryDto;
import com.velo.platform.dto.PayoutRequestDto;
import com.velo.platform.services.DriverEarningsService;
import com.velo.platform.services.PayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@RestController
@RequestMapping("/drivers/earnings")
@RequiredArgsConstructor
@Tag(name = "Driver Earnings", description = "Driver Earnings and Payouts management APIs")
@SecurityRequirement(name = "bearerAuth")
@Validated
public class DriverEarningsController {

    private final DriverEarningsService driverEarningsService;
    private final PayoutService payoutService;

    @GetMapping
    @Operation(summary = "Get driver earnings history")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<Page<DriverEarningDto>> getEarningsHistory(
            @RequestParam(defaultValue = "0") @Min(0) Integer pageOffset,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) Integer pageSize) {
        PageRequest pageRequest = PageRequest.of(pageOffset, pageSize, Sort.by(Sort.Direction.DESC, "createdTime"));
        return ResponseEntity.ok(driverEarningsService.getEarningsHistory(pageRequest));
    }

    @GetMapping("/summary")
    @Operation(summary = "Get earnings summary")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<EarningsSummaryDto> getEarningsSummary(
            @RequestParam(defaultValue = "DAILY") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        if (date == null) date = LocalDate.now();
        
        return switch (period.toUpperCase()) {
            case "WEEKLY" -> ResponseEntity.ok(driverEarningsService.getWeeklySummary(date));
            case "MONTHLY" -> ResponseEntity.ok(driverEarningsService.getMonthlySummary(date));
            default -> ResponseEntity.ok(driverEarningsService.getDailySummary(date));
        };
    }
    
    @GetMapping("/balance")
    @Operation(summary = "Get available payout balance")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<BigDecimal> getAvailableBalance() {
        return ResponseEntity.ok(driverEarningsService.getAvailableBalance());
    }

    @PostMapping("/payout")
    @Operation(summary = "Request a payout")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<PayoutRequestDto> requestPayout(@RequestParam BigDecimal amount) {
        return ResponseEntity.ok(payoutService.requestPayout(amount));
    }

    @GetMapping("/payouts")
    @Operation(summary = "Get payout requests history")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<Page<PayoutRequestDto>> getMyPayouts(
            @RequestParam(defaultValue = "0") @Min(0) Integer pageOffset,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) Integer pageSize) {
        PageRequest pageRequest = PageRequest.of(pageOffset, pageSize, Sort.by(Sort.Direction.DESC, "requestedAt"));
        return ResponseEntity.ok(payoutService.getMyPayouts(pageRequest));
    }
}
