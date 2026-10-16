package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.configs.AuthRateLimitProperties;
import com.velo.platform.entities.PasswordResetToken;
import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.PasswordResetTokenRepository;
import com.velo.platform.repositories.RefreshTokenRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.repositories.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class AuthControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private WalletRepository walletRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private AuthRateLimitProperties authRateLimitProperties;

    @BeforeEach
    void setUp() {
        riderRepository.deleteAll();
        walletRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("POST /auth/signup should create user and return 201")
    void signup_ShouldCreateUser() throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("John Doe");
        signupDto.setEmail("test@example.com");
        signupDto.setPassword("password123");

                mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value("test@example.com"));
    }

    @Test
    @DisplayName("signup and profile updates cannot set a user's simulated flag")
    void publicAuthEndpoints_ShouldIgnoreSimulatedFlag() throws Exception {
        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Public User","email":"public-sim@test.com","password":"password123","simulated":true}
                                """))
                .andExpect(status().isCreated());

        var user = userRepository.findByEmail("public-sim@test.com").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(user.getSimulated()).isFalse();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/auth/profile")
                        .header("X-Test-User-Id", user.getId())
                        .header("X-Test-Email", user.getEmail())
                        .header("X-Test-Role", "RIDER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Public","lastName":"Updated","phoneNumber":"+15550001000","simulated":true}
                                """))
                .andExpect(status().isOk());

        org.assertj.core.api.Assertions.assertThat(userRepository.findById(user.getId()).orElseThrow().getSimulated())
                .isFalse();
    }

    @Test
    @DisplayName("POST /auth/signup with duplicate email should return 409")
    void signup_WithDuplicateEmail_ShouldReturn409() throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("Test User");
        signupDto.setEmail("duplicate@test.com");
        signupDto.setPassword("password123");

        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("already exists")));
    }

    @Test
    @DisplayName("POST /auth/signup resolves an anonymous signup to the host tenant slug")
    void signup_WithTenantSlugHeader_ShouldUseThatTenant() throws Exception {
        Tenant tenant = tenantRepository.save(Tenant.builder()
                .slug("saffron-routes").name("Saffron Routes").active(true).build());

        mockMvc.perform(post("/auth/signup")
                        .header("X-Velo-Tenant-Slug", "saffron-routes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Saffron Guest","email":"guest-slug@test.com","password":"password123"}
                                """))
                .andExpect(status().isCreated());

        var user = userRepository.findByEmail("guest-slug@test.com").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(user.getTenantId()).isEqualTo(tenant.getId());
    }

    @Test
    @DisplayName("POST /auth/signup rejects an unknown tenant slug with 400")
    void signup_WithUnknownTenantSlug_ShouldReturn400() throws Exception {
        mockMvc.perform(post("/auth/signup")
                        .header("X-Velo-Tenant-Slug", "ghost-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Ghost","email":"ghost@test.com","password":"password123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("Unknown tenant")));
    }

    @Test
    @DisplayName("POST /auth/login with a missing field should return 400")
    void login_WithMissingField_ShouldReturn400() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"nobody@test.com"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Input validation failed"));
    }

    @Test
    @DisplayName("POST /auth/login should return token")
    void login_ShouldReturnToken() throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("Test User");
        signupDto.setEmail("login@test.com");
        signupDto.setPassword("password123");

        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated());

                mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "email": "login@test.com",
                                "password": "password123"
                            }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").exists())
                .andExpect(jsonPath("$.data.email").value("login@test.com"))
                .andExpect(jsonPath("$.data.role").value("RIDER"));
    }

    @Test
    @DisplayName("POST /auth/login with wrong password should return generic 401")
    void login_WithWrongPassword_ShouldReturn401() throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("Test User");
        signupDto.setEmail("wrong@test.com");
        signupDto.setPassword("password123");

        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated());

                mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "email": "wrong@test.com",
                                "password": "wrongpassword"
                            }
                            """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Invalid email or password"));
    }

    @Test
    @DisplayName("POST /auth/login uses the same response for unknown email and wrong password")
    void login_UnknownEmail_ShouldReturnSameGeneric401() throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("Known User");
        signupDto.setEmail("known@test.com");
        signupDto.setPassword("password123");
        mockMvc.perform(post("/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated());

        String unknownEmailResponse = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"unknown@test.com","password":"password"}
                            """))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String wrongPasswordResponse = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"known@test.com","password":"wrong-password"}
                            """))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(objectMapper.readTree(unknownEmailResponse).path("error").path("message").asText())
                .isEqualTo(objectMapper.readTree(wrongPasswordResponse).path("error").path("message").asText());
    }

    @Test
    @DisplayName("POST /auth/forgot-password returns the same success response for known and unknown emails")
    void forgotPassword_ShouldNotEnumerateUsers() throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("Reset User");
        signupDto.setEmail("reset@test.com");
        signupDto.setPassword("password123");
        mockMvc.perform(post("/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated());

        String knownResponse = mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"reset@test.com\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String unknownResponse = mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"missing@test.com\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(objectMapper.readTree(knownResponse).path("data").path("message").asText())
                .isEqualTo(objectMapper.readTree(unknownResponse).path("data").path("message").asText())
                .isEqualTo("If an account exists with this email, a password reset link has been sent");
    }

    @Test
    @DisplayName("PUT /auth/profile updates the authenticated user's profile")
    void updateProfile_UpdatesCurrentUser() throws Exception {
        createUser("profile@test.com", "Profile User");
        Long userId = userRepository.findByEmail("profile@test.com").orElseThrow().getId();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/auth/profile")
                        .header("X-Test-User-Id", userId)
                        .header("X-Test-Email", "profile@test.com")
                        .header("X-Test-Role", "RIDER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Updated","lastName":"Rider","phoneNumber":"+15550001000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").exists());

        org.assertj.core.api.Assertions.assertThat(userRepository.findById(userId).orElseThrow().getPhoneNumber())
                .isEqualTo("+15550001000");
    }

    @Test
    @DisplayName("POST /auth/reset-password rejects expired reset tokens")
    void resetPassword_RejectsExpiredToken() throws Exception {
        createUser("expired-reset@test.com", "Expired Reset");
        requestPasswordReset("expired-reset@test.com");
        PasswordResetToken resetToken = passwordResetTokenRepository.findAll().get(0);
        resetToken.setExpiryDate(LocalDateTime.now().minusMinutes(1));
        passwordResetTokenRepository.save(resetToken);

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", resetToken.getToken(), "newPassword", "new-password-123"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("Reset token is expired or already used"));
    }

    @Test
    @DisplayName("POST /auth/reset-password consumes reset tokens exactly once")
    void resetPassword_RejectsTokenReuse() throws Exception {
        createUser("single-use-reset@test.com", "Single Use");
        requestPasswordReset("single-use-reset@test.com");
        String resetToken = passwordResetTokenRepository.findAll().get(0).getToken();
        String resetBody = objectMapper.writeValueAsString(Map.of(
                "token", resetToken, "newPassword", "new-password-123"));

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Password reset successful"));

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("Reset token is expired or already used"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"single-use-reset@test.com","password":"new-password-123"}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /auth/refresh replays the same pair in grace and revokes reuse after grace")
    void refresh_ReplaysWithinGraceAndDetectsReuseAfterGrace() throws Exception {
        createUser("refresh@test.com", "Refresh User");
        String loginResponse = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"refresh@test.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expiresInSeconds").value(900))
                .andReturn().getResponse().getContentAsString();
        String originalRefreshToken = objectMapper.readTree(loginResponse).path("data").path("refreshToken").asText();
        org.assertj.core.api.Assertions.assertThat(refreshTokenRepository.findAll().get(0).getTokenHash())
                .isNotEqualTo(originalRefreshToken);

        String rotatedResponse = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", originalRefreshToken))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var rotatedData = objectMapper.readTree(rotatedResponse).path("data");
        String rotatedRefreshToken = rotatedData.path("refreshToken").asText();
        org.assertj.core.api.Assertions.assertThat(rotatedRefreshToken).isNotEqualTo(originalRefreshToken);

        String replayedResponse = mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", originalRefreshToken))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var replayedData = objectMapper.readTree(replayedResponse).path("data");
        org.assertj.core.api.Assertions.assertThat(replayedData.path("token").asText())
                .isEqualTo(rotatedData.path("token").asText());
        org.assertj.core.api.Assertions.assertThat(replayedData.path("refreshToken").asText())
                .isEqualTo(rotatedRefreshToken);

        var consumedToken = refreshTokenRepository.findAll().stream()
                .filter(token -> token.getConsumedAt() != null)
                .findFirst().orElseThrow();
        consumedToken.setConsumedAt(LocalDateTime.now().minusSeconds(21));
        refreshTokenRepository.saveAndFlush(consumedToken);

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", originalRefreshToken))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", rotatedRefreshToken))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /auth/logout revokes the refresh token family")
    void logout_RevokesRefreshTokenFamily() throws Exception {
        createUser("logout@test.com", "Logout User");
        String loginResponse = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"logout@test.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String refreshToken = objectMapper.readTree(loginResponse).path("data").path("refreshToken").asText();

        mockMvc.perform(post("/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /auth/login rate limits by account and returns Retry-After")
    void login_RateLimitsRepeatedAccountAttempts() throws Exception {
        createUser("rate-limited@test.com", "Rate Limited");
        int originalAccountLimit = authRateLimitProperties.getAccountLimit();
        authRateLimitProperties.setAccountLimit(2);
        try {
            String body = """
                    {"email":"rate-limited@test.com","password":"wrong-password"}
                    """;
            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isUnauthorized());

            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().exists("Retry-After"))
                    .andExpect(jsonPath("$.error.message").value("Too many authentication requests. Please try again later."));
        } finally {
            authRateLimitProperties.setAccountLimit(originalAccountLimit);
        }
    }

    private void createUser(String email, String name) throws Exception {
        SignupDto signupDto = new SignupDto();
        signupDto.setName(name);
        signupDto.setEmail(email);
        signupDto.setPassword("password123");
        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupDto)))
                .andExpect(status().isCreated());
    }

    private void requestPasswordReset(String email) throws Exception {
        mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isOk());
    }
}
