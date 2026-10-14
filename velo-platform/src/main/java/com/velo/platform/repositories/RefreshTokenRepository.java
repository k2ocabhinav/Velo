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
}
