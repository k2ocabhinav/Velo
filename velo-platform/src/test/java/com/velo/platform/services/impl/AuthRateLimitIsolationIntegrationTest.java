package com.velo.platform.services.impl;

import com.velo.platform.configs.AuthRateLimitProperties;
import com.velo.platform.exceptions.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves the limiter starts every test method from a clean slate even though its bean and windows
 * live in a context cached across test classes. Run in order: the first method leaves the account
 * bucket over its limit, and without {@link com.velo.platform.config.AuthRateLimitResetListener} the
 * second method would inherit that counter and throw instead of passing.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthRateLimitIsolationIntegrationTest {

    private static final String ACCOUNT = "rate-limit-isolation@example.test";
    private static final String CLIENT_IP = "203.0.113.7";

    @Autowired private AuthRateLimitService authRateLimitService;
    @Autowired private AuthRateLimitProperties properties;

    @Test
    @Order(1)
    void leavesTheSharedAccountBucketThrottled() {
        withAccountLimit(1, () -> {
            authRateLimitService.check(request(), ACCOUNT);
            assertThatThrownBy(() -> authRateLimitService.check(request(), ACCOUNT))
                    .isInstanceOf(RateLimitExceededException.class);
        });
    }

    @Test
    @Order(2)
    void startsFromACleanLimiterDespiteThePreviousTest() {
        withAccountLimit(1, () -> assertThatCode(() -> authRateLimitService.check(request(), ACCOUNT))
                .doesNotThrowAnyException());
    }

    private void withAccountLimit(int limit, Runnable body) {
        int original = properties.getAccountLimit();
        properties.setAccountLimit(limit);
        try {
            body.run();
        } finally {
            properties.setAccountLimit(original);
        }
    }

    private HttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(CLIENT_IP);
        return request;
    }
}
