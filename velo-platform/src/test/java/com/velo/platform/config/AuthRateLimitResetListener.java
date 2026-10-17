package com.velo.platform.config;

import com.velo.platform.services.impl.AuthRateLimitService;
import org.springframework.test.context.TestContext;
import org.springframework.test.context.support.AbstractTestExecutionListener;

/**
 * The auth rate limiter keeps its per-account and per-IP windows inside a bean whose lifetime is the
 * cached Spring context, not the test. A counter left behind by one test class therefore leaks into
 * the next, so a test that logs in late in the suite can be rejected with 429 purely because of
 * execution order. Clear the state before every test method so results never depend on order.
 *
 * <p>Registered globally through Spring's {@code TestExecutionListener} service loader
 * ({@code META-INF/spring.factories}).
 */
public class AuthRateLimitResetListener extends AbstractTestExecutionListener {

    @Override
    public void beforeTestMethod(TestContext testContext) {
        AuthRateLimitService limiter = testContext.getApplicationContext()
                .getBeanProvider(AuthRateLimitService.class)
                .getIfAvailable();
        if (limiter != null) {
            limiter.reset();
        }
    }
}
