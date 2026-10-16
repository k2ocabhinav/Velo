package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.dto.PayoutRequestDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.PayoutRequest;
import com.velo.platform.entities.enums.PayoutStatus;
import com.velo.platform.entities.enums.TransactionMethod;
import com.velo.platform.exceptions.BadRequestException;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.PayoutRequestRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.DriverEarningsService;
import com.velo.platform.services.PayoutService;
import com.velo.platform.services.WalletService;
import com.velo.platform.services.TenantScopeService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PayoutServiceImpl implements PayoutService {

    private final PayoutRequestRepository payoutRequestRepository;
    private final DriverEarningsService driverEarningsService;
    private final DriverRepository driverRepository;
    private final WalletService walletService;
    private final ModelMapper modelMapper;
    private final TenantScopeService tenantScopeService;

    @Override
    @Transactional
    public PayoutRequestDto requestPayout(BigDecimal amount) {
        if (amount == null) {
            throw new BadRequestException("Payout amount is required");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Payout amount must be greater than zero");
        }

        // Lock the driver row first so two concurrent requests cannot both pass the balance check
        // and overdraw the same earnings.
        Driver driver = getCurrentDriverForUpdate();
        BigDecimal availableBalance = driverEarningsService.getAvailableBalance(driver);
        if (amount.compareTo(availableBalance) > 0) {
            throw new RuntimeConflictException("Insufficient earnings balance for payout request");
        }

        PayoutRequest payoutRequest = PayoutRequest.builder()
                .tenantId(driver.getTenantId())
                .driver(driver)
                .amount(amount)
                .status(PayoutStatus.PENDING)
                .build();

        return modelMapper.map(payoutRequestRepository.save(payoutRequest), PayoutRequestDto.class);
    }

    @Override
    @Transactional
    public PayoutRequestDto approvePayout(Long payoutId, String adminNote) {
        PayoutRequest request = payoutRequestRepository.findByIdAndTenantIdForUpdate(payoutId, currentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Payout request not found"));

        if (request.getStatus() != PayoutStatus.PENDING) {
            throw new RuntimeConflictException("Can only approve PENDING requests");
        }

        request.setStatus(PayoutStatus.APPROVED);
        request.setAdminNote(adminNote);
        return modelMapper.map(payoutRequestRepository.save(request), PayoutRequestDto.class);
    }

    @Override
    @Transactional
    public PayoutRequestDto rejectPayout(Long payoutId, String adminNote) {
        PayoutRequest request = payoutRequestRepository.findByIdAndTenantIdForUpdate(payoutId, currentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Payout request not found"));

        if (request.getStatus() != PayoutStatus.PENDING) {
            throw new RuntimeConflictException("Can only reject PENDING requests");
        }

        request.setStatus(PayoutStatus.REJECTED);
        request.setAdminNote(adminNote);
        return modelMapper.map(payoutRequestRepository.save(request), PayoutRequestDto.class);
    }

    @Override
    @Transactional
    public PayoutRequestDto processPayout(Long payoutId) {
        PayoutRequest request = payoutRequestRepository.findByIdAndTenantIdForUpdate(payoutId, currentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Payout request not found"));

        if (request.getStatus() != PayoutStatus.APPROVED) {
            throw new RuntimeConflictException("Can only process APPROVED requests");
        }

        walletService.addMoneyToWallet(request.getDriver().getUser(), request.getAmount(), 
                "PAYOUT_" + UUID.randomUUID().toString(), null, TransactionMethod.BANKING);

        request.setStatus(PayoutStatus.PROCESSED);
        request.setProcessedAt(UtcTimes.now());
        return modelMapper.map(payoutRequestRepository.save(request), PayoutRequestDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PayoutRequestDto> getPendingPayouts(PageRequest pageRequest) {
        return payoutRequestRepository.findByTenantIdAndStatusOrderByRequestedAtAsc(
                        currentTenantId(), PayoutStatus.PENDING, pageRequest)
                .map(request -> modelMapper.map(request, PayoutRequestDto.class));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PayoutRequestDto> getPayouts(PayoutStatus status, PageRequest pageRequest) {
        Long tenantId = currentTenantId();
        Page<PayoutRequest> requests = status == null
                ? payoutRequestRepository.findByTenantIdOrderByRequestedAtDesc(tenantId, pageRequest)
                : payoutRequestRepository.findByTenantIdAndStatusOrderByRequestedAtAsc(tenantId, status, pageRequest);
        return requests.map(request -> modelMapper.map(request, PayoutRequestDto.class));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PayoutRequestDto> getMyPayouts(PageRequest pageRequest) {
        Driver driver = getCurrentDriver();
        return payoutRequestRepository.findByDriverOrderByRequestedAtDesc(driver, pageRequest)
                .map(request -> modelMapper.map(request, PayoutRequestDto.class));
    }

    private Driver getCurrentDriver() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return driverRepository.findByUserIdAndTenantId(principal.getUserId(), principal.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Driver profile not found"));
    }

    private Driver getCurrentDriverForUpdate() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return driverRepository.findByUserIdAndTenantIdForUpdate(principal.getUserId(), principal.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Driver profile not found"));
    }

    private Long currentTenantId() {
        return tenantScopeService.requireCurrentTenantId();
    }
}
