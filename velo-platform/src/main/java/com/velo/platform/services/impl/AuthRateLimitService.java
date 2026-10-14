package com.velo.platform.services.impl;

import com.velo.platform.configs.AuthRateLimitProperties;
import com.velo.platform.exceptions.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthRateLimitService {

    private static final DefaultRedisScript<Long> INCREMENT_AND_CHECK = new DefaultRedisScript<>(
            "local count = redis.call('INCR', KEYS[1]); " +
                    "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; " +
                    "if count > tonumber(ARGV[2]) then " +
                    "local ttl = redis.call('PTTL', KEYS[1]); " +
                    "if ttl < 1 then return tonumber(ARGV[1]); end; return ttl; " +
                    "end; return 0;",
            Long.class);

    private final StringRedisTemplate redisTemplate;
    private final AuthRateLimitProperties properties;
    private final ConcurrentHashMap<String, WindowCounter> localCounters = new ConcurrentHashMap<>();
    private final AtomicLong checks = new AtomicLong();

    public void check(HttpServletRequest request, String accountIdentifier) {
        if (!properties.isEnabled()) {
            return;
        }

        long windowMillis = Math.max(1_000L, properties.getWindow().toMillis());
        if (checks.incrementAndGet() % 256 == 0) {
            long cutoff = System.currentTimeMillis() - windowMillis;
            localCounters.entrySet().removeIf(entry -> entry.getValue().windowStartedAt < cutoff);
        }

        long ipRetryMillis = consume("ip:" + resolveClientAddress(request), properties.getIpLimit(), windowMillis);
        long accountRetryMillis = 0;
        if (StringUtils.hasText(accountIdentifier)) {
            accountRetryMillis = consume("account:" + accountIdentifier.trim().toLowerCase(),
                    properties.getAccountLimit(), windowMillis);
        }

        long retryMillis = Math.max(ipRetryMillis, accountRetryMillis);
        if (retryMillis > 0) {
            throw new RateLimitExceededException((retryMillis + 999L) / 1_000L);
        }

    }

    private long consume(String bucket, int limit, long windowMillis) {
        String key = "velo:auth:rate:" + sha256(bucket);
        if (properties.isRedisEnabled()) {
            try {
                Long retryMillis = redisTemplate.execute(INCREMENT_AND_CHECK,
                        List.of(key), Long.toString(windowMillis), Integer.toString(Math.max(1, limit)));
                if (retryMillis != null) {
                    return Math.max(0L, retryMillis);
                }
            } catch (RuntimeException exception) {
                log.debug("Auth rate-limit Redis unavailable; using in-memory counters");
            }
        }

        return consumeLocally(key, Math.max(1, limit), windowMillis);
    }

    private long consumeLocally(String key, int limit, long windowMillis) {
        long now = System.currentTimeMillis();
        long[] retry = {0L};
        localCounters.compute(key, (ignored, counter) -> {
            WindowCounter current = counter;
            if (current == null || now - current.windowStartedAt >= windowMillis) {
                current = new WindowCounter(now, 0);
            }
            current.count++;
            if (current.count > limit) {
                retry[0] = Math.max(1L, windowMillis - (now - current.windowStartedAt));
            }
            return current;
        });
        return retry[0];
    }

    private String resolveClientAddress(HttpServletRequest request) {
        String remoteAddress = normalizeIp(request.getRemoteAddr());
        if (remoteAddress == null || !isTrustedProxy(remoteAddress)) {
            return remoteAddress == null ? "unknown" : remoteAddress;
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (!StringUtils.hasText(forwardedFor)) {
            return remoteAddress;
        }

        List<String> chain = new ArrayList<>();
        for (String part : forwardedFor.split(",")) {
            String candidate = normalizeIp(part);
            if (candidate == null) {
                return remoteAddress;
            }
            chain.add(candidate);
        }

        String currentHop = remoteAddress;
        for (int index = chain.size() - 1; index >= 0; index--) {
            if (!isTrustedProxy(currentHop)) {
                return currentHop;
            }
            currentHop = chain.get(index);
        }
        return currentHop;
    }

    private boolean isTrustedProxy(String address) {
        String configured = properties.getTrustedProxies();
        if (!StringUtils.hasText(configured)) {
            return false;
        }
        return List.of(configured.split(",")).stream()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .anyMatch(cidr -> {
                    try {
                        return new IpAddressMatcher(cidr).matches(address);
                    } catch (IllegalArgumentException exception) {
                        return false;
                    }
                });
    }

    private String normalizeIp(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String ip = value.trim();
        if (ip.startsWith("[")) {
            int closingBracket = ip.indexOf(']');
            if (closingBracket > 0) {
                ip = ip.substring(1, closingBracket);
            }
        }
        if (ip.contains(":")) {
            if (!ip.matches("[0-9a-fA-F:.]+")) {
                return null;
            }
        } else if (!ip.matches("\\d{1,3}(\\.\\d{1,3}){3}")) {
            return null;
        }
        try {
            if (!ip.contains(":")) {
                byte[] octets = new byte[4];
                String[] parts = ip.split("\\.");
                for (int index = 0; index < parts.length; index++) {
                    int octet = Integer.parseInt(parts[index]);
                    if (octet > 255) {
                        return null;
                    }
                    octets[index] = (byte) octet;
                }
                return InetAddress.getByAddress(octets).getHostAddress();
            }
            return InetAddress.getByName(ip).getHostAddress();
        } catch (Exception exception) {
            return null;
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static final class WindowCounter {
        private final long windowStartedAt;
        private int count;

        private WindowCounter(long windowStartedAt, int count) {
            this.windowStartedAt = windowStartedAt;
            this.count = count;
        }
    }
}
