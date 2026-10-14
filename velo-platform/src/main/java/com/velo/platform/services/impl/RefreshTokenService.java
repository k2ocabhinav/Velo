package com.velo.platform.services.impl;

import com.velo.platform.entities.User;
import com.velo.platform.exceptions.InvalidRefreshTokenException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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

    @Value("${auth.refresh-token.ttl:PT720H}")
    private Duration tokenTtl;

    public String issue(User user) {
        String rawToken = newRawToken();
        Long tenantId = user.getTenantId() == null ? DEFAULT_TENANT_ID : user.getTenantId();
        refreshTokenStore.create(hash(rawToken), UUID.randomUUID().toString(), user, tenantId,
                LocalDateTime.now().plus(tokenTtl));
        return rawToken;
    }

    public RotatedToken rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidRefreshTokenException();
        }
        String nextRawToken = newRawToken();
        RefreshTokenStore.RotationResult result = refreshTokenStore.rotate(
                hash(rawToken), hash(nextRawToken), LocalDateTime.now(), LocalDateTime.now().plus(tokenTtl));
        if (result.status() != RefreshTokenStore.RotationResult.Status.ROTATED) {
            throw new InvalidRefreshTokenException();
        }
        return new RotatedToken(result.userId(), result.email(), result.role(), result.tenantId(), nextRawToken);
    }

    public void revoke(String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) {
            refreshTokenStore.revoke(hash(rawToken), LocalDateTime.now());
        }
    }

    public void revokeAllForUser(Long userId, Long tenantId) {
        refreshTokenStore.revokeAllForUser(userId,
                tenantId == null ? DEFAULT_TENANT_ID : tenantId, LocalDateTime.now());
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

    public record RotatedToken(Long userId, String email, String role, Long tenantId, String refreshToken) { }
}
