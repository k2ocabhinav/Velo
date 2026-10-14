package com.velo.platform.configs;

import com.velo.platform.entities.RefreshToken;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.RefreshTokenRepository;
import com.velo.platform.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RefreshTokenCleanupRepositoryIntegrationTest {

    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private UserRepository userRepository;

    @Test
    void cleanupDeletesOnlyExpiredOrLongRevokedRowsForOneTenantAndHonorsBatchSize() {
        User user = userRepository.save(User.builder()
                .firstName("Cleanup")
                .lastName("Test")
                .email("cleanup-tokens@test.com")
                .password("encoded")
                .active(true)
                .tenantId(1L)
                .roles(Set.of(Role.RIDER))
                .build());
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime revokedBefore = now.minusDays(30);
        refreshTokenRepository.saveAll(List.of(
                token("cleanup-expired-1", user, 1L, now.minusSeconds(5), null),
                token("cleanup-expired-2", user, 1L, now.minusSeconds(4), null),
                token("cleanup-expired-3", user, 1L, now.minusSeconds(3), null),
                token("cleanup-revoked-old", user, 1L, now.plusDays(2), now.minusDays(31)),
                token("cleanup-revoked-recent", user, 1L, now.plusDays(2), now.minusDays(2)),
                token("cleanup-active", user, 1L, now.plusDays(2), null),
                token("cleanup-other-tenant", user, 2L, now.minusSeconds(1), null)));
        refreshTokenRepository.flush();

        assertThat(refreshTokenRepository.deleteCleanupBatch(1L, now, revokedBefore, 2)).isEqualTo(2);
        assertThat(refreshTokenRepository.deleteCleanupBatch(1L, now, revokedBefore, 2)).isEqualTo(2);

        List<String> remainingHashes = refreshTokenRepository.findAll().stream()
                .map(RefreshToken::getTokenHash)
                .toList();
        assertThat(remainingHashes).containsExactlyInAnyOrder(
                "cleanup-revoked-recent", "cleanup-active", "cleanup-other-tenant");
    }

    private RefreshToken token(String hash, User user, Long tenantId,
                               LocalDateTime expiresAt, LocalDateTime revokedAt) {
        return RefreshToken.builder()
                .tokenHash(hash)
                .familyId("11111111-1111-1111-1111-111111111111")
                .user(user)
                .tenantId(tenantId)
                .expiresAt(expiresAt)
                .revokedAt(revokedAt)
                .build();
    }
}
