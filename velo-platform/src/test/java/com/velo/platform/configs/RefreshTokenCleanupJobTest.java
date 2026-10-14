package com.velo.platform.configs;

import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.RefreshTokenRepository;
import com.velo.platform.repositories.TenantRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RefreshTokenCleanupJobTest {

    @Test
    void cleanupRunsOneBoundedTenantScopedBatchForEachTenant() {
        RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
        TenantRepository tenantRepository = mock(TenantRepository.class);
        RefreshTokenCleanupJob job = new RefreshTokenCleanupJob(refreshTokenRepository, tenantRepository);
        ReflectionTestUtils.setField(job, "revokedRetention", Duration.ofDays(30));
        ReflectionTestUtils.setField(job, "batchSize", 17);
        when(tenantRepository.findAllByOrderByIdAsc()).thenReturn(List.of(
                Tenant.builder().id(2L).slug("north").name("North").build(),
                Tenant.builder().id(9L).slug("south").name("South").build()));
        when(refreshTokenRepository.deleteCleanupBatch(eq(2L), any(LocalDateTime.class),
                any(LocalDateTime.class), eq(17))).thenReturn(17);
        when(refreshTokenRepository.deleteCleanupBatch(eq(9L), any(LocalDateTime.class),
                any(LocalDateTime.class), eq(17))).thenReturn(0);

        job.deleteExpiredAndLongRevokedTokens();

        verify(refreshTokenRepository).deleteCleanupBatch(eq(2L), any(LocalDateTime.class),
                any(LocalDateTime.class), eq(17));
        verify(refreshTokenRepository).deleteCleanupBatch(eq(9L), any(LocalDateTime.class),
                any(LocalDateTime.class), eq(17));
    }
}
