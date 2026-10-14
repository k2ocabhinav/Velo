package com.velo.platform.services.impl;

import com.velo.platform.dto.TenantBrandingUpdateDto;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.TenantConfiguration;
import com.velo.platform.entities.enums.DispatchMode;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.TenantBrandingCacheService;
import com.velo.platform.services.TenantScopeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantConfigurationServiceImplTest {

    @Mock private TenantRepository tenantRepository;
    @Mock private TenantConfigurationRepository tenantConfigurationRepository;
    @Mock private TenantScopeService tenantScopeService;
    @Mock private TenantBrandingCacheService tenantBrandingCacheService;
    @InjectMocks private TenantConfigurationServiceImpl service;

    @Test
    void adminBrandingSaveEvictsTheTenantPublicCache() {
        Tenant tenant = Tenant.builder().id(9L).slug("northstar").name("Northstar").build();
        TenantConfiguration config = TenantConfiguration.builder()
                .id(12L)
                .tenant(tenant)
                .brandName("Old brand")
                .primaryColor("#2563EB")
                .riderLabel("Rider")
                .driverLabel("Driver")
                .tripLabel("Trip")
                .dispatchMode(DispatchMode.RIDE_HAILING)
                .build();
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(9L);
        when(tenantRepository.findById(9L)).thenReturn(Optional.of(tenant));
        when(tenantConfigurationRepository.findByTenant_Id(9L)).thenReturn(Optional.of(config));
        when(tenantConfigurationRepository.save(any(TenantConfiguration.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var updated = service.updateCurrentTenantBranding(TenantBrandingUpdateDto.builder()
                .brandName("Northstar Mobility")
                .primaryColor("#0057B8")
                .riderLabel("Passenger")
                .driverLabel("Courier")
                .tripLabel("Journey")
                .dispatchMode(DispatchMode.RIDE_HAILING)
                .build());

        assertEquals("Northstar Mobility", updated.getBrandName());
        verify(tenantBrandingCacheService).evict("northstar");
    }
}
