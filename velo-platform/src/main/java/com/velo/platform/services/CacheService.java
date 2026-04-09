package com.velo.platform.services;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@Slf4j
public class CacheService {

    private static final String DRIVER_LOCATION_PREFIX = "driver:location:";
    private static final String AVAILABLE_DRIVERS_KEY = "drivers:available";
    private static final String DASHBOARD_CACHE_KEY = "admin:dashboard";
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(5);

    private final RedisTemplate<String, Object> redisTemplate;
    private final Counter cacheHitCounter;
    private final Counter cacheMissCounter;
    private final Counter cacheErrorCounter;

    public CacheService(RedisTemplate<String, Object> redisTemplate, MeterRegistry meterRegistry) {
        this.redisTemplate = redisTemplate;
        this.cacheHitCounter = meterRegistry.counter("velo.cache.hit");
        this.cacheMissCounter = meterRegistry.counter("velo.cache.miss");
        this.cacheErrorCounter = meterRegistry.counter("velo.cache.error");
    }

    public void cacheDriverLocation(Long driverId, Object location) {
        safeWrite(() -> redisTemplate.opsForValue().set(
                DRIVER_LOCATION_PREFIX + driverId,
                location,
                Duration.ofSeconds(30)
        ));
    }

    public Object getDriverLocation(Long driverId) {
        return safeRead(DRIVER_LOCATION_PREFIX + driverId);
    }

    public void cacheAvailableDriversCount(Long count) {
        safeWrite(() -> redisTemplate.opsForValue().set(AVAILABLE_DRIVERS_KEY, count, DEFAULT_TTL));
    }

    public Long getAvailableDriversCount() {
        Object count = safeRead(AVAILABLE_DRIVERS_KEY);
        return count != null ? ((Number) count).longValue() : null;
    }

    public void cacheDashboard(Object dashboard) {
        safeWrite(() -> redisTemplate.opsForValue().set(DASHBOARD_CACHE_KEY, dashboard, DEFAULT_TTL));
    }

    public Object getCachedDashboard() {
        return safeRead(DASHBOARD_CACHE_KEY);
    }

    public void evictDashboardCache() {
        safeDelete(DASHBOARD_CACHE_KEY);
    }

    public void evictDriverLocation(Long driverId) {
        safeDelete(DRIVER_LOCATION_PREFIX + driverId);
    }

    public void evictAvailableDriversCache() {
        safeDelete(AVAILABLE_DRIVERS_KEY);
    }

    public boolean isRedisAvailable() {
        try (RedisConnection connection = redisTemplate.getConnectionFactory().getConnection()) {
            Object pingResult = connection.ping();
            return pingResult != null;
        } catch (Exception exception) {
            log.warn("Redis availability check failed: {}", exception.getMessage());
            cacheErrorCounter.increment();
            return false;
        }
    }

    public double getCacheHitCount() {
        return cacheHitCounter.count();
    }

    public double getCacheMissCount() {
        return cacheMissCounter.count();
    }

    public double getCacheErrorCount() {
        return cacheErrorCounter.count();
    }

    private Object safeRead(String key) {
        try {
            Object value = redisTemplate.opsForValue().get(key);
            if (value == null) {
                cacheMissCounter.increment();
            } else {
                cacheHitCounter.increment();
            }
            return value;
        } catch (Exception exception) {
            cacheErrorCounter.increment();
            log.warn("Redis read failed for key {}: {}", key, exception.getMessage());
            return null;
        }
    }

    private void safeWrite(Runnable operation) {
        try {
            operation.run();
        } catch (Exception exception) {
            cacheErrorCounter.increment();
            log.warn("Redis write failed: {}", exception.getMessage());
        }
    }

    private void safeDelete(String key) {
        try {
            redisTemplate.delete(key);
        } catch (Exception exception) {
            cacheErrorCounter.increment();
            log.warn("Redis delete failed for key {}: {}", key, exception.getMessage());
        }
    }
}
