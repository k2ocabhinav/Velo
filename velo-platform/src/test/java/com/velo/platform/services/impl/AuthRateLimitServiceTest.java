package com.velo.platform.services.impl;

import com.velo.platform.configs.AuthRateLimitProperties;
import com.velo.platform.exceptions.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.doAnswer;

class AuthRateLimitServiceTest {

    @Test
    void appliesPerIpWindowAndReturnsRetryAfter() {
        AuthRateLimitProperties properties = properties(2, 100);
        AuthRateLimitService limiter = new AuthRateLimitService(mock(StringRedisTemplate.class), properties);
        HttpServletRequest request = request("198.51.100.10", null);

        limiter.check(request, null);
        limiter.check(request, null);

        assertThatThrownBy(() -> limiter.check(request, null))
                .isInstanceOf(RateLimitExceededException.class)
                .satisfies(exception -> assertThat(((RateLimitExceededException) exception).getRetryAfterSeconds())
                        .isBetween(1L, 60L));
    }

    @Test
    void appliesPerAccountLimitAcrossClientIps() {
        AuthRateLimitProperties properties = properties(100, 1);
        AuthRateLimitService limiter = new AuthRateLimitService(mock(StringRedisTemplate.class), properties);

        limiter.check(request("198.51.100.11", null), "person@example.com");

        assertThatThrownBy(() -> limiter.check(request("198.51.100.12", null), "PERSON@example.com"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void ignoresForwardedForFromUntrustedClient() {
        AuthRateLimitProperties properties = properties(1, 100);
        AuthRateLimitService limiter = new AuthRateLimitService(mock(StringRedisTemplate.class), properties);

        limiter.check(request("198.51.100.13", "192.0.2.1"), null);

        assertThatThrownBy(() -> limiter.check(request("198.51.100.13", "192.0.2.2"), null))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void honorsForwardedForOnlyWhenRemoteAddressIsTrusted() {
        AuthRateLimitProperties properties = properties(1, 100);
        properties.setTrustedProxies("10.0.0.0/8");
        AuthRateLimitService limiter = new AuthRateLimitService(mock(StringRedisTemplate.class), properties);

        limiter.check(request("10.0.0.5", "198.51.100.21"), null);
        limiter.check(request("10.0.0.5", "198.51.100.22"), null);
    }

    @Test
    void fallsBackToInMemoryWhenRedisIsUnavailable() {
        AuthRateLimitProperties properties = properties(1, 100);
        properties.setRedisEnabled(true);
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        doAnswer(invocation -> {
            throw new IllegalStateException("Redis unavailable");
        }).when(redisTemplate).execute(any(RedisScript.class), anyList(), any(Object[].class));
        AuthRateLimitService limiter = new AuthRateLimitService(redisTemplate, properties);
        HttpServletRequest request = request("198.51.100.30", null);

        limiter.check(request, null);

        assertThatThrownBy(() -> limiter.check(request, null))
                .isInstanceOf(RateLimitExceededException.class);
    }

    private AuthRateLimitProperties properties(int ipLimit, int accountLimit) {
        AuthRateLimitProperties properties = new AuthRateLimitProperties();
        properties.setRedisEnabled(false);
        properties.setWindow(Duration.ofMinutes(1));
        properties.setIpLimit(ipLimit);
        properties.setAccountLimit(accountLimit);
        return properties;
    }

    private MockHttpServletRequest request(String remoteAddress, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        return request;
    }
}
