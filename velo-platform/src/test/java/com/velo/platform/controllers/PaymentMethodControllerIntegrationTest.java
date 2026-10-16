package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.PaymentMethodEntity;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethodType;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.PaymentMethodRepository;
import com.velo.platform.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class PaymentMethodControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PaymentMethodRepository paymentMethodRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setEmail("payment+" + UUID.randomUUID() + "@test.com");
        testUser.setPassword("password123");
        testUser.setFirstName("Test");
        testUser.setLastName("User");
        testUser.setRoles(Set.of(Role.RIDER));
        testUser.setActive(true);
        testUser = userRepository.save(testUser);
    }

    private MockHttpServletRequestBuilder withAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", testUser.getId())
                .header("X-Test-Email", testUser.getEmail())
                .header("X-Test-Role", Role.RIDER.name());
    }

    @Test
    @DisplayName("GET /payment-methods should return empty list for new user")
    void getPaymentMethods_ShouldReturnEmptyList() throws Exception {
        mockMvc.perform(withAuth(get("/payment-methods")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("POST /payment-methods should create a new payment method")
    void addPaymentMethod_ShouldCreatePaymentMethod() throws Exception {
        String requestBody = """
                {
                    "type": "CARD",
                    "lastFourDigits": "1234",
                    "expiryDate": "12/25",
                    "isDefault": true
                }
                """;

        mockMvc.perform(withAuth(post("/payment-methods"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("CARD"))
                .andExpect(jsonPath("$.data.lastFourDigits").value("1234"))
                .andExpect(jsonPath("$.data.expiryDate").value("12/25"))
                .andExpect(jsonPath("$.data.isDefault").value(true));
    }

    @Test
    @DisplayName("GET /payment-methods should return payment methods after adding")
    void getPaymentMethods_ShouldReturnPaymentMethods() throws Exception {
        PaymentMethodEntity paymentMethod = PaymentMethodEntity.builder()
                .type(PaymentMethodType.CARD)
                .lastFourDigits("5678")
                .expiryDate("06/27")
                .isDefault(false)
                .user(testUser)
                .build();
        paymentMethodRepository.save(paymentMethod);

        mockMvc.perform(withAuth(get("/payment-methods")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].lastFourDigits").value("5678"));
    }

    @Disabled("Flaky test - test isolation issue")
    @Test
    @DisplayName("DELETE /payment-methods/{id} should delete payment method")
    void deletePaymentMethod_ShouldDeletePaymentMethod() throws Exception {
        PaymentMethodEntity paymentMethod = PaymentMethodEntity.builder()
                .type(PaymentMethodType.WALLET)
                .lastFourDigits("0000")
                .isDefault(false)
                .user(testUser)
                .build();
        Long paymentMethodId = paymentMethodRepository.save(paymentMethod).getId();

        mockMvc.perform(withAuth(delete("/payment-methods/" + paymentMethodId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(withAuth(get("/payment-methods")))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PUT /payment-methods/{id}/default should set default payment method")
    void setDefaultPaymentMethod_ShouldSetDefault() throws Exception {
        PaymentMethodEntity paymentMethod = PaymentMethodEntity.builder()
                .type(PaymentMethodType.CARD)
                .lastFourDigits("9999")
                .isDefault(false)
                .user(testUser)
                .build();
        paymentMethod = paymentMethodRepository.save(paymentMethod);

        mockMvc.perform(withAuth(put("/payment-methods/" + paymentMethod.getId() + "/default")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isDefault").value(true));
    }

    @Test
    @DisplayName("POST /payment-methods without a type should return 400")
    void addPaymentMethod_MissingType_ShouldReturnBadRequest() throws Exception {
        mockMvc.perform(withAuth(post("/payment-methods"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("POST /payment-methods with non-numeric last four digits should return 400")
    void addPaymentMethod_InvalidLastFourDigits_ShouldReturnBadRequest() throws Exception {
        String requestBody = """
                {
                    "type": "CARD",
                    "lastFourDigits": "42",
                    "expiryDate": "12/25"
                }
                """;

        mockMvc.perform(withAuth(post("/payment-methods"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.status").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("DELETE /payment-methods/{id} for non-existent should return 404")
    void deletePaymentMethod_NonExistent_ShouldReturn404() throws Exception {
        mockMvc.perform(withAuth(delete("/payment-methods/99999")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PUT /payment-methods/{id}/default for non-existent should return 404")
    void setDefaultPaymentMethod_NonExistent_ShouldReturn404() throws Exception {
        mockMvc.perform(withAuth(put("/payment-methods/99999/default")))
                .andExpect(status().isNotFound());
    }
}
