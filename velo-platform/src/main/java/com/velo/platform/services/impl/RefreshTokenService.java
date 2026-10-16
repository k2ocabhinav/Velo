package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.entities.User;
import com.velo.platform.exceptions.InvalidRefreshTokenException;
import com.velo.platform.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Long DEFAULT_TENANT_ID = 1L;

    private final RefreshTokenStore refreshTokenStore;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenReplayCipher refreshTokenReplayCipher;

    @Value("${auth.refresh-token.ttl:PT720H}")
    private Duration tokenTtl;

    @Value("${auth.refresh-token.rotation-grace-window:PT20S}")
    private Duration rotationGraceWindow;

    public String issue(User user) {
        String rawToken = newRawToken();
        Long tenantId = user.getTenantId() == null ? DEFAULT_TENANT_ID : user.getTenantId();
        refreshTokenStore.create(hash(rawToken), UUID.randomUUID().toString(), user, tenantId,
                UtcTimes.now().plus(tokenTtl));
        return rawToken;
    }

    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public RotatedToken rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidRefreshTokenException();
        }
        LocalDateTime now = UtcTimes.now();
        String nextRawToken = newRawToken();
        RefreshTokenStore.RotationResult result = refreshTokenStore.rotate(
                hash(rawToken), hash(nextRawToken), now, now.plus(tokenTtl), rotationGraceWindow);
        if (result.status() == RefreshTokenStore.RotationResult.Status.REPLAY) {
            try {
                RefreshTokenReplayCipher.ReplayResponse replay = refreshTokenReplayCipher.decrypt(result.replayCiphertext());
                return new RotatedToken(result.userId(), result.email(), result.role(), result.tenantId(),
                        replay.accessToken(), replay.refreshToken());
            } catch (IllegalStateException exception) {
                refreshTokenStore.revoke(hash(rawToken), now);
                throw new InvalidRefreshTokenException();
            }
        }
        if (result.status() != RefreshTokenStore.RotationResult.Status.ROTATED) {
            throw new InvalidRefreshTokenException();
        }

        String accessToken = jwtTokenProvider.generateToken(result.email(), result.userId(),
                result.role(), result.tenantId());
        String encryptedResponse = refreshTokenReplayCipher.encrypt(accessToken, nextRawToken);
        refreshTokenStore.storeRotationResponse(result.predecessorId(), result.tenantId(), encryptedResponse);
        return new RotatedToken(result.userId(), result.email(), result.role(), result.tenantId(),
                accessToken, nextRawToken);
    }

    public void revoke(String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) {
            refreshTokenStore.revoke(hash(rawToken), UtcTimes.now());
        }
    }

    public void revokeAllForUser(Long userId, Long tenantId) {
        refreshTokenStore.revokeAllForUser(userId,
                tenantId == null ? DEFAULT_TENANT_ID : tenantId, UtcTimes.now());
    }

    private String newRawToken() {
        byte[] tokenBytes = new byte[32];
        SECURE_RANDOM.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    private String hash(String rawToken) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record RotatedToken(Long userId, String email, String role, Long tenantId,
                               String accessToken, String refreshToken) { }
}
