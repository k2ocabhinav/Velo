package com.velo.platform.configs;

import com.velo.platform.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class SecurityConfigTest {

    @Test
    void corsConfiguration_UsesExactConfiguredOrigins() {
        SecurityConfig config = new SecurityConfig(mock(JwtAuthenticationFilter.class), mock(Environment.class));
        ReflectionTestUtils.setField(config, "allowedOriginsProperty", "https://admin.example.com,https://rider.example.com");

        CorsConfiguration cors = config.corsConfigurationSource()
                .getCorsConfiguration(new MockHttpServletRequest("GET", "/api/test"));

        assertThat(cors.getAllowedOrigins())
                .containsExactly("https://admin.example.com", "https://rider.example.com");
        assertThat(cors.getAllowedOriginPatterns()).isNull();
    }

    @Test
    void nonLocalConfiguration_RejectsMissingSecrets() {
        assertThatThrownBy(() -> SecurityConfig.validateNonLocalConfiguration(
                "", "", "", "", List.of("https://app.example.com")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be set");
    }

    @Test
    void nonLocalStartupValidation_RejectsMissingSecretsForActiveProductionProfile() {
        Environment environment = mock(Environment.class);
        org.mockito.Mockito.when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        SecurityConfig config = new SecurityConfig(mock(JwtAuthenticationFilter.class), environment);
        ReflectionTestUtils.setField(config, "jwtSecret", "");
        ReflectionTestUtils.setField(config, "datasourceUrl", "jdbc:postgresql://db.example.com:5432/velo");
        ReflectionTestUtils.setField(config, "datasourceUsername", "velo_app");
        ReflectionTestUtils.setField(config, "datasourcePassword", "prod-secret");
        ReflectionTestUtils.setField(config, "allowedOriginsProperty", "https://app.example.com");

        assertThatThrownBy(config::validateNonLocalConfiguration)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be set");
    }

    @Test
    void nonLocalConfiguration_RejectsDevelopmentDefaultsAndWildcardOrigins() {
        assertThatThrownBy(() -> SecurityConfig.validateNonLocalConfiguration(
                "changeThisJwtSecretKeyForLocalDevelopmentOnly1234567890",
                "jdbc:postgresql://db.example.com:5432/velo",
                "velo_app",
                "prod-secret",
                List.of("https://app.example.com")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Development");

        assertThatThrownBy(() -> SecurityConfig.validateNonLocalConfiguration(
                "a-secure-production-jwt-signing-secret-value",
                "jdbc:postgresql://db.example.com:5432/velo",
                "velo_app",
                "prod-secret",
                List.of("https://*.example.com")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CORS_ALLOWED_ORIGINS");
    }

    @Test
    void nonLocalConfiguration_AcceptsExplicitSecretsAndOrigins() {
        SecurityConfig.validateNonLocalConfiguration(
                "a-secure-production-jwt-signing-secret-value",
                "jdbc:postgresql://db.example.com:5432/velo",
                "velo_app",
                "prod-secret",
                List.of("https://admin.example.com", "https://rider.example.com"));
    }
}
