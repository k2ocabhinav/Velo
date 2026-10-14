package com.velo.platform.repositories;

import com.velo.platform.entities.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {
    Page<WalletTransaction> findByWallet_IdAndTenantIdOrderByTimestampDescIdDesc(
            Long walletId, Long tenantId, Pageable pageable);
}
