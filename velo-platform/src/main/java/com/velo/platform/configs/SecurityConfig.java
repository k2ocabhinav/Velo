package com.velo.platform.configs;

import com.velo.platform.security.JwtAuthenticationFilter;
import com.velo.platform.security.ForwardedHttpsEnforcementFilter;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@Profile("!test-security-bypass")
public class SecurityConfig {

    private static final String DEVELOPMENT_JWT_SECRET =
            "changeThisJwtSecretKeyForLocalDevelopmentOnly1234567890";
    private static final String DEVELOPMENT_DATASOURCE_URL =
            "jdbc:postgresql://localhost:5432/postgres?useSSL=false";

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final Environment environment;

    @Value("${springdoc.api-docs.enabled:true}")
    private boolean apiDocsEnabled;
    @Value("${springdoc.swagger-ui.enabled:true}")
    private boolean swaggerUiEnabled;
    @Value("${jwt.secret:}")
    private String jwtSecret;
    @Value("${spring.datasource.url:}")
    private String datasourceUrl;
    @Value("${spring.datasource.username:}")
    private String datasourceUsername;
    @Value("${spring.datasource.password:}")
    private String datasourcePassword;
    @Value("${app.security.allowed-origins:}")
    private String allowedOriginsProperty;

    @PostConstruct
    void validateNonLocalConfiguration() {
        List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
        if (activeProfiles.isEmpty()
                || activeProfiles.stream().allMatch("local"::equals)
                || activeProfiles.contains("test")) {
            return;
        }

        validateNonLocalConfiguration(
                jwtSecret, datasourceUrl, datasourceUsername, datasourcePassword, configuredAllowedOrigins());
    }

    static void validateNonLocalConfiguration(
            String jwtSecret,
            String datasourceUrl,
            String datasourceUsername,
            String datasourcePassword,
            List<String> allowedOrigins) {
        if (!hasText(jwtSecret) || !hasText(datasourceUrl) || !hasText(datasourceUsername)
                || !hasText(datasourcePassword)) {
            throw new IllegalStateException(
                    "JWT_SECRET and SPRING_DATASOURCE_URL/USERNAME/PASSWORD must be set outside local/test profiles");
        }
        if (DEVELOPMENT_JWT_SECRET.equals(jwtSecret)
                || DEVELOPMENT_DATASOURCE_URL.equals(datasourceUrl)
                || "postgres".equalsIgnoreCase(datasourceUsername)
                || "user".equals(datasourcePassword)) {
            throw new IllegalStateException("Development JWT or database credentials cannot be used outside local/test profiles");
        }
        if (allowedOrigins.isEmpty() || allowedOrigins.stream().anyMatch(origin -> origin.contains("*") || !hasText(origin))) {
            throw new IllegalStateException("Explicit CORS_ALLOWED_ORIGINS are required outside local/test profiles");
        }
    }

    private List<String> configuredAllowedOrigins() {
        if (!hasText(allowedOriginsProperty)) {
            return List.of();
        }
        return Arrays.stream(allowedOriginsProperty.split(","))
                .map(String::trim)
                .filter(SecurityConfig::hasText)
                .toList();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password",
                                "/auth/refresh", "/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/onBoardNewDriver/**").authenticated()
                        .requestMatchers("/api/v1/public/**").permitAll()
                        .requestMatchers("/auth/profile").authenticated()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**")
                        .access((authentication, context) -> new org.springframework.security.authorization.AuthorizationDecision(
                                apiDocsEnabled && swaggerUiEnabled
                        ))
                        .requestMatchers("/actuator/prometheus").hasRole("ADMIN")
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        if (requiresForwardedHttps()) {
            http.addFilterBefore(new ForwardedHttpsEnforcementFilter(), JwtAuthenticationFilter.class);
        }

        return http.build();
    }

    private boolean requiresForwardedHttps() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equals("prod") || profile.equals("staging"));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(configuredAllowedOrigins());
        config.setAllowedMethods(List.of(
                HttpMethod.GET.name(),
                HttpMethod.POST.name(),
                HttpMethod.PUT.name(),
                HttpMethod.DELETE.name(),
                HttpMethod.PATCH.name()
        ));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
