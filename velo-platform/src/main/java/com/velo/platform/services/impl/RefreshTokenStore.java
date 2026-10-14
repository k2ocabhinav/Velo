package com.velo.platform.services.impl;

import com.velo.platform.entities.RefreshToken;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.RefreshTokenRepository;
import com.velo.platform.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RefreshTokenStore {

    private static final Long DEFAULT_TENANT_ID = 1L;

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;

    @Transactional
    public void create(String tokenHash, String familyId, User user, Long tenantId, LocalDateTime expiresAt) {
        RefreshToken token = RefreshToken.builder()
                .tokenHash(tokenHash)
                .familyId(familyId)
                .user(user)
                .tenantId(effectiveTenantId(tenantId))
                .expiresAt(expiresAt)
                .build();
        refreshTokenRepository.save(token);
    }

    @Transactional
    public RotationResult rotate(String tokenHash,
                                 String newTokenHash,
                                 LocalDateTime now,
                                 LocalDateTime nextExpiry) {
        RefreshToken current = refreshTokenRepository.findByTokenHashForUpdate(tokenHash).orElse(null);
        if (current == null) {
            return RotationResult.invalid();
        }

        if (current.getConsumedAt() != null) {
            refreshTokenRepository.revokeFamily(current.getFamilyId(), current.getTenantId(), now);
            return RotationResult.reused();
        }

        if (current.getRevokedAt() != null || !current.getExpiresAt().isAfter(now)) {
            refreshTokenRepository.revokeFamily(current.getFamilyId(), current.getTenantId(), now);
            return RotationResult.invalid();
        }

        Long userId = current.getUser().getId();
        Long tenantId = current.getTenantId();
        User user = userRepository.findByIdAndTenantId(userId, tenantId).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getActive())
                || !effectiveTenantId(user.getTenantId()).equals(tenantId)) {
            refreshTokenRepository.revokeFamily(current.getFamilyId(), tenantId, now);
            return RotationResult.invalid();
        }

        current.setConsumedAt(now);
        refreshTokenRepository.save(current);
        refreshTokenRepository.save(RefreshToken.builder()
                .tokenHash(newTokenHash)
                .familyId(current.getFamilyId())
                .user(user)
                .tenantId(tenantId)
                .expiresAt(nextExpiry)
                .build());

        return RotationResult.rotated(userId, user.getEmail(), selectRole(user.getRoles()), tenantId);
    }

    @Transactional
    public void revoke(String tokenHash, LocalDateTime now) {
        RefreshToken token = refreshTokenRepository.findByTokenHashForUpdate(tokenHash).orElse(null);
        if (token != null) {
            refreshTokenRepository.revokeFamily(token.getFamilyId(), token.getTenantId(), now);
        }
    }

    @Transactional
    public void revokeAllForUser(Long userId, Long tenantId, LocalDateTime now) {
        refreshTokenRepository.revokeAllForUser(userId, effectiveTenantId(tenantId), now);
    }

    private String selectRole(Set<Role> roles) {
        if (roles.contains(Role.ADMIN)) {
            return Role.ADMIN.name();
        }
        if (roles.contains(Role.DRIVER)) {
            return Role.DRIVER.name();
        }
        return Role.RIDER.name();
    }

    private Long effectiveTenantId(Long tenantId) {
        return tenantId == null ? DEFAULT_TENANT_ID : tenantId;
    }

    public record RotationResult(Status status, Long userId, String email, String role, Long tenantId) {
        public enum Status { ROTATED, INVALID, REUSED }

        public static RotationResult rotated(Long userId, String email, String role, Long tenantId) {
            return new RotationResult(Status.ROTATED, userId, email, role, tenantId);
        }

        public static RotationResult invalid() {
            return new RotationResult(Status.INVALID, null, null, null, null);
        }

        public static RotationResult reused() {
            return new RotationResult(Status.REUSED, null, null, null, null);
        }
    }
}
