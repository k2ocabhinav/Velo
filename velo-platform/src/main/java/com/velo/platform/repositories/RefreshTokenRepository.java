package com.velo.platform.repositories;

import com.velo.platform.entities.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from RefreshToken token where token.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken token set token.revokedAt = :revokedAt " +
            "where token.familyId = :familyId and token.tenantId = :tenantId and token.revokedAt is null")
    int revokeFamily(@Param("familyId") String familyId,
                     @Param("tenantId") Long tenantId,
                     @Param("revokedAt") LocalDateTime revokedAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken token set token.revokedAt = :revokedAt " +
            "where token.user.id = :userId and token.tenantId = :tenantId and token.revokedAt is null")
    int revokeAllForUser(@Param("userId") Long userId,
                         @Param("tenantId") Long tenantId,
                         @Param("revokedAt") LocalDateTime revokedAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "WITH cleanup_batch AS (" +
            "SELECT id FROM auth_refresh_token " +
            "WHERE tenant_id = :tenantId " +
            "AND (expires_at <= :expiredBefore OR revoked_at <= :revokedBefore) " +
            "ORDER BY id LIMIT :batchSize FOR UPDATE SKIP LOCKED) " +
            "DELETE FROM auth_refresh_token token USING cleanup_batch batch " +
            "WHERE token.id = batch.id AND token.tenant_id = :tenantId", nativeQuery = true)
    int deleteCleanupBatch(@Param("tenantId") Long tenantId,
                           @Param("expiredBefore") LocalDateTime expiredBefore,
                           @Param("revokedBefore") LocalDateTime revokedBefore,
                           @Param("batchSize") int batchSize);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken token set token.rotationResponseCiphertext = :encryptedResponse " +
            "where token.id = :predecessorId and token.tenantId = :tenantId " +
            "and token.consumedAt is not null and token.revokedAt is null")
    int storeRotationResponse(@Param("predecessorId") Long predecessorId,
                              @Param("tenantId") Long tenantId,
                              @Param("encryptedResponse") String encryptedResponse);
}
