package com.velo.platform.config;

import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Spring Security keeps the authenticated principal in a thread-local
 * ({@link SecurityContextHolder}). The JVM runs the whole suite on one thread, so a test that
 * installs a context and never clears it leaks its principal into every following test; several
 * unit tests even install a Mockito mock context, on which a later {@code setAuthentication} call is
 * a no-op. That makes results depend on test execution order. Clear the context after every test so
 * order can never matter.
 *
 * <p>Registered globally through JUnit's extension auto-detection
 * ({@code junit.jupiter.extensions.autodetection.enabled=true}).
 */
public class SecurityContextResetExtension implements AfterEachCallback {

    @Override
    public void afterEach(ExtensionContext context) {
        SecurityContextHolder.clearContext();
    }
}
