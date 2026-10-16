package com.velo.platform.services;

import com.velo.platform.configs.FareConfig;
import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TenantTariffServiceTest {
    private TenantRepository tenantRepository;
    private TenantTariffService tariffService;

    @BeforeEach
    void setUp() {
        tenantRepository = mock(TenantRepository.class);
        FareConfig fareConfig = new FareConfig();
        tariffService = new TenantTariffService(tenantRepository, fareConfig);
    }

    @Test
    void calculatesFareWithTheRequestingTenantsTariffAndMinimum() {
        Tenant saffron = Tenant.builder()
                .id(2L)
                .baseFare(new BigDecimal("250.00"))
                .perKmRate(new BigDecimal("35.00"))
                .minimumFare(new BigDecimal("600.00"))
                .build();
        when(tenantRepository.findById(2L)).thenReturn(Optional.of(saffron));

        TenantTariffService.Tariff tariff = tariffService.findForTenant(2L);

        assertThat(tariff.calculate(34.4, BigDecimal.ONE)).isEqualByComparingTo("1454.00");
        assertThat(tariff.calculate(0, BigDecimal.ONE)).isEqualByComparingTo("600.00");
    }

    @Test
    void defaultsMissingTenantTariffToExistingGlobalRates() {
        when(tenantRepository.findById(1L)).thenReturn(Optional.empty());

        assertThat(tariffService.findForTenant(1L).calculate(34.81, BigDecimal.ONE))
                .isEqualByComparingTo("74.62");
    }
}
