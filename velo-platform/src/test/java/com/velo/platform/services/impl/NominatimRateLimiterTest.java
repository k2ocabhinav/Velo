package com.velo.platform.services.impl;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class NominatimRateLimiterTest {
    @Test
    void leavesAtLeastOneSecondBetweenProviderCalls() {
        NominatimRateLimiter rateLimiter = new NominatimRateLimiter();

        long firstCompletion = rateLimiter.execute(System::nanoTime);
        long secondCompletion = rateLimiter.execute(System::nanoTime);

        assertThat(secondCompletion - firstCompletion).isGreaterThanOrEqualTo(Duration.ofSeconds(1).toNanos());
    }
}
