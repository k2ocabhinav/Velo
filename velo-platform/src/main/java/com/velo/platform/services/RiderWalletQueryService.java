package com.velo.platform.services;

import com.velo.platform.dto.RiderWalletDto;
import org.springframework.data.domain.Pageable;

public interface RiderWalletQueryService {
    RiderWalletDto getCurrentRiderWallet(Pageable pageable);
}
