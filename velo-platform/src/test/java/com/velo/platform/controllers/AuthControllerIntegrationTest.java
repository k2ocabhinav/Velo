package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.repositories.RiderRepository;
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

    @BeforeEach
    void setUp() {
        riderRepository.deleteAll();
        walletRepository.deleteAll();
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
}
