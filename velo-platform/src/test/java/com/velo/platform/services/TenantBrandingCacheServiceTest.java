package com.velo.platform.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.dto.TenantBrandingDto;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TenantBrandingCacheServiceTest {

    @Test
    void usesLocalFallbackAndEvictsItWhenRedisIsUnavailable() {
        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        when(redisTemplate.opsForValue()).thenThrow(new IllegalStateException("Redis unavailable"));
        TenantBrandingCacheService cache = new TenantBrandingCacheService(redisTemplate, new ObjectMapper());
        TenantBrandingDto branding = TenantBrandingDto.builder().brandName("Northstar").primaryColor("#0057B8").build();

        cache.put("northstar", branding);

        assertSame(branding, cache.get("northstar"));
        cache.evict("northstar");
        assertNull(cache.get("northstar"));
        verify(redisTemplate).delete("tenant:branding:northstar");
    }
}
