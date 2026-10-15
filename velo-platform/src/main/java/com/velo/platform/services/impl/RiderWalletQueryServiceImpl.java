package com.velo.platform.services.impl;

import com.velo.platform.dto.RiderWalletDto;
import com.velo.platform.dto.RiderWalletTransactionDto;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.TenantConfiguration;
import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.WalletTransaction;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.repositories.WalletRepository;
import com.velo.platform.repositories.WalletTransactionRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.RiderWalletQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RiderWalletQueryServiceImpl implements RiderWalletQueryService {

    private static final String DEFAULT_CURRENCY = "USD";

    private final RiderRepository riderRepository;
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final TenantConfigurationRepository tenantConfigurationRepository;

    @Override
    @Transactional(readOnly = true)
    public RiderWalletDto getCurrentRiderWallet(Pageable pageable) {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Long tenantId = principal.getTenantId();
        Rider rider = riderRepository.findByUserIdAndTenantId(principal.getUserId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found"));
        User user = rider.getUser();
        Wallet wallet = walletRepository.findByUserIdAndTenantId(user.getId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found for current rider"));

        var transactions = walletTransactionRepository
                .findByWallet_IdAndTenantIdOrderByTimestampDescIdDesc(wallet.getId(), tenantId, pageable)
                .map(this::toTransactionDto);
        String currency = tenantConfigurationRepository.findByTenant_Id(tenantId)
                .map(TenantConfiguration::getCurrency)
                .orElse(DEFAULT_CURRENCY);

        return RiderWalletDto.builder()
                .balance(wallet.getBalance())
                .currency(currency)
                .transactions(transactions)
                .build();
    }

    private RiderWalletTransactionDto toTransactionDto(WalletTransaction transaction) {
        return RiderWalletTransactionDto.builder()
                .id(transaction.getId())
                .type(transaction.getTransactionType())
                .amount(transaction.getAmount())
                .method(transaction.getTransactionMethod())
                .rideReference(transaction.getRide() == null ? null : transaction.getRide().getId())
                .timestamp(transaction.getTimestamp())
                .build();
    }
}
