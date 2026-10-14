package com.velo.platform.services.impl;

import com.velo.platform.exceptions.GeocodingUnavailableException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.function.Supplier;

/** Serializes provider calls and leaves at least one second between requests per app instance. */
@Component
public class NominatimRateLimiter {
    private static final long MIN_INTERVAL_NANOS = Duration.ofSeconds(1).toNanos();
    private long nextRequestAtNanos;

    public synchronized <T> T execute(Supplier<T> request) {
        long waitNanos = nextRequestAtNanos - System.nanoTime();
        if (waitNanos > 0) {
            try {
                long millis = waitNanos / 1_000_000;
                int nanos = (int) (waitNanos % 1_000_000);
                Thread.sleep(millis, nanos);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new GeocodingUnavailableException(exception);
            }
        }

        try {
            return request.get();
        } finally {
            nextRequestAtNanos = System.nanoTime() + MIN_INTERVAL_NANOS;
        }
    }
}
