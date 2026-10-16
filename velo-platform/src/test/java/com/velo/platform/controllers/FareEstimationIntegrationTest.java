package com.velo.platform.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.dto.FareEstimateRequestDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.config.TestSecurityConfig;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
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
import java.math.BigDecimal;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "test-security-bypass"})
@Import(TestSecurityConfig.class)
@Transactional
class FareEstimationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RiderRepository riderRepository;

    @Autowired
    private TenantRepository tenantRepository;

    private Rider testRider;
    private Long defaultTenantId;

    @BeforeEach
    void setUp() {
        riderRepository.deleteAll();
        userRepository.deleteAll();
        Tenant defaultTenant = tenantRepository.findById(1L).orElseGet(() -> tenantRepository.save(Tenant.builder()
                .slug("fare-test-default-" + UUID.randomUUID())
                .name("Fare Test Default")
                .build()));
        defaultTenant.setBaseFare(new BigDecimal("5.00"));
        defaultTenant.setPerKmRate(new BigDecimal("2.00"));
        defaultTenant.setMinimumFare(BigDecimal.ZERO);
        defaultTenantId = tenantRepository.save(defaultTenant).getId();

        User riderUser = new User();
        riderUser.setEmail("rider@test.com");
        riderUser.setPassword("password123");
        riderUser.setRoles(Set.of(Role.RIDER));
        riderUser.setActive(true);
        riderUser.setTenantId(defaultTenantId);
        riderUser = userRepository.save(riderUser);

        testRider = new Rider();
        testRider.setUser(riderUser);
        testRider.setTenantId(defaultTenantId);
        testRider = riderRepository.save(testRider);
    }

    private MockHttpServletRequestBuilder withRiderAuth(MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", testRider.getUser().getId())
                .header("X-Test-Email", testRider.getUser().getEmail())
                .header("X-Test-Role", Role.RIDER.name())
                .header("X-Test-Tenant-Id", String.valueOf(testRider.getTenantId()));
    }

    @Test
    void getFareEstimate_ShouldReturnEstimate() throws Exception {
        FareEstimateRequestDto requestDto = new FareEstimateRequestDto();
        requestDto.setPickupLocation(new PointDto(new double[]{77.1, 28.1}));
        requestDto.setDropOffLocation(new PointDto(new double[]{77.2, 28.2}));
        requestDto.setPaymentMethod(PaymentMethod.WALLET);

        mockMvc.perform(withRiderAuth(post("/riders/fare-estimate"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.estimatedFare").exists())
                .andExpect(jsonPath("$.data.distanceKm").exists())
                .andExpect(jsonPath("$.data.durationMinutes").exists());
    }

    @Test
    void fareEstimateEndpointUsesEachRidersTenantTariff() throws Exception {
        Tenant saffron = tenantRepository.save(Tenant.builder()
                .slug("tariff-test-" + UUID.randomUUID())
                .name("Tariff Test")
                .active(true)
                .baseFare(new BigDecimal("250.00"))
                .perKmRate(new BigDecimal("35.00"))
                .minimumFare(new BigDecimal("600.00"))
                .build());
        Rider saffronRider = createRider("saffron-" + UUID.randomUUID() + "@test.com", saffron.getId());
        FareEstimateRequestDto requestDto = new FareEstimateRequestDto();
        requestDto.setPickupLocation(new PointDto(new double[]{77.1, 28.1}));
        requestDto.setDropOffLocation(new PointDto(new double[]{77.2, 28.2}));
        requestDto.setPaymentMethod(PaymentMethod.CASH);

        BigDecimal defaultEstimate = estimateFare(testRider, requestDto);
        BigDecimal saffronEstimate = estimateFare(saffronRider, requestDto);

        org.assertj.core.api.Assertions.assertThat(saffronEstimate).isGreaterThan(defaultEstimate);
        org.assertj.core.api.Assertions.assertThat(saffronEstimate)
                .isGreaterThanOrEqualTo(new BigDecimal("600.00"));
    }

    private BigDecimal estimateFare(Rider rider, FareEstimateRequestDto requestDto) throws Exception {
        String response = mockMvc.perform(withRiderAuthFor(rider, post("/riders/fare-estimate"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.baseFare").value(rider.getTenantId().equals(defaultTenantId) ? 5.0 : 250.0))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).path("data").path("estimatedFare").decimalValue();
    }

    private MockHttpServletRequestBuilder withRiderAuthFor(Rider rider, MockHttpServletRequestBuilder builder) {
        return builder
                .header("X-Test-User-Id", rider.getUser().getId())
                .header("X-Test-Email", rider.getUser().getEmail())
                .header("X-Test-Role", Role.RIDER.name())
                .header("X-Test-Tenant-Id", rider.getTenantId());
    }

    private Rider createRider(String email, Long tenantId) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("password123");
        user.setRoles(Set.of(Role.RIDER));
        user.setActive(true);
        user.setTenantId(tenantId);
        user = userRepository.save(user);
        Rider rider = new Rider();
        rider.setUser(user);
        rider.setTenantId(tenantId);
        return riderRepository.save(rider);
    }
}
