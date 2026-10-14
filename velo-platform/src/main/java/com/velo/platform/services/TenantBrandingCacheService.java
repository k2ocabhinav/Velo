package com.velo.platform.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.dto.TenantBrandingDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantBrandingCacheService {

    private static final String KEY_PREFIX = "tenant:branding:";
    private static final Duration TTL = Duration.ofMinutes(5);

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, LocalEntry> localCache = new ConcurrentHashMap<>();

    public TenantBrandingDto get(String tenantSlug) {
        String key = key(tenantSlug);
        try {
            Object value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                TenantBrandingDto branding = value instanceof TenantBrandingDto dto
                        ? dto
                        : objectMapper.convertValue(value, TenantBrandingDto.class);
                localCache.put(tenantSlug, new LocalEntry(branding, Instant.now().plus(TTL)));
                return branding;
            }
        } catch (Exception exception) {
            log.debug("Tenant branding Redis read failed for slug {}; using local cache", tenantSlug, exception);
        }

        LocalEntry entry = localCache.get(tenantSlug);
        if (entry == null) return null;
        if (entry.expiresAt().isBefore(Instant.now())) {
            localCache.remove(tenantSlug, entry);
            return null;
        }
        return entry.branding();
    }

    public void put(String tenantSlug, TenantBrandingDto branding) {
        localCache.put(tenantSlug, new LocalEntry(branding, Instant.now().plus(TTL)));
        try {
            redisTemplate.opsForValue().set(key(tenantSlug), branding, TTL);
        } catch (Exception exception) {
            log.debug("Tenant branding Redis write failed for slug {}; kept in local cache", tenantSlug, exception);
        }
    }

    public void evict(String tenantSlug) {
        localCache.remove(tenantSlug);
        try {
            redisTemplate.delete(key(tenantSlug));
        } catch (Exception exception) {
            log.warn("Tenant branding Redis eviction failed for slug {}", tenantSlug, exception);
        }
    }

    private String key(String tenantSlug) {
        return KEY_PREFIX + tenantSlug;
    }

    private record LocalEntry(TenantBrandingDto branding, Instant expiresAt) { }
}
