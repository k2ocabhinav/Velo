package com.velo.platform.configs;

import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.RefreshTokenRepository;
import com.velo.platform.repositories.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenCleanupJob {

    private final RefreshTokenRepository refreshTokenRepository;
    private final TenantRepository tenantRepository;

    @Value("${auth.refresh-token.revoked-retention:PT720H}")
    private Duration revokedRetention;

    @Value("${auth.refresh-token.cleanup-batch-size:500}")
    private int batchSize;

    @Scheduled(fixedDelayString = "${auth.refresh-token.cleanup-interval-ms:3600000}")
    @Transactional
    public void deleteExpiredAndLongRevokedTokens() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime revokedBefore = now.minus(revokedRetention);
        int deleted = 0;
        for (Tenant tenant : tenantRepository.findAllByOrderByIdAsc()) {
            int tenantDeleted = refreshTokenRepository.deleteCleanupBatch(
                    tenant.getId(), now, revokedBefore, batchSize);
            deleted += tenantDeleted;
        }
        if (deleted > 0) {
            log.info("Refresh-token cleanup removed {} tokens", deleted);
        }
    }
}
