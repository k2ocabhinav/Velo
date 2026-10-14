package com.velo.platform.services.impl;

import com.velo.platform.dto.TenantBrandingDto;
import com.velo.platform.dto.TenantBrandingUpdateDto;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.TenantConfiguration;
import com.velo.platform.entities.enums.DispatchMode;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.TenantConfigurationService;
import com.velo.platform.services.TenantBrandingCacheService;
import com.velo.platform.services.TenantScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantConfigurationServiceImpl implements TenantConfigurationService {

    private final TenantRepository tenantRepository;
    private final TenantConfigurationRepository tenantConfigurationRepository;
    private final TenantScopeService tenantScopeService;
    private final TenantBrandingCacheService tenantBrandingCacheService;

    @Override
    @Transactional(readOnly = true)
    public TenantBrandingDto getBrandingByTenantSlug(String tenantSlug) {
        TenantBrandingDto cachedBranding = tenantBrandingCacheService.get(tenantSlug);
        if (cachedBranding != null) return cachedBranding;

        Tenant tenant = tenantRepository.findBySlug(tenantSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found for slug " + tenantSlug));
        TenantConfiguration config = tenantConfigurationRepository.findByTenant_Id(tenant.getId())
                .orElseGet(() -> defaultConfiguration(tenant));
        TenantBrandingDto branding = toDto(config);
        tenantBrandingCacheService.put(tenantSlug, branding);
        return branding;
    }

    @Override
    @Transactional(readOnly = true)
    public TenantBrandingDto getCurrentTenantBranding() {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found for id " + tenantId));
        TenantConfiguration config = tenantConfigurationRepository.findByTenant_Id(tenantId)
                .orElseGet(() -> defaultConfiguration(tenant));
        return toDto(config);
    }

    @Override
    @Transactional
    public TenantBrandingDto updateCurrentTenantBranding(TenantBrandingUpdateDto updateDto) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found for id " + tenantId));

        TenantConfiguration config = tenantConfigurationRepository.findByTenant_Id(tenantId)
                .orElseGet(() -> defaultConfiguration(tenant));

        config.setBrandName(updateDto.getBrandName().trim());
        config.setPrimaryColor(updateDto.getPrimaryColor().trim());
        config.setLogoUrl(updateDto.getLogoUrl() == null ? null : updateDto.getLogoUrl().trim());
        config.setRiderLabel(updateDto.getRiderLabel().trim());
        config.setDriverLabel(updateDto.getDriverLabel().trim());
        config.setTripLabel(updateDto.getTripLabel().trim());
        config.setDispatchMode(updateDto.getDispatchMode() == null ? DispatchMode.RIDE_HAILING : updateDto.getDispatchMode());

        TenantBrandingDto branding = toDto(tenantConfigurationRepository.save(config));
        tenantBrandingCacheService.evict(tenant.getSlug());
        return branding;
    }

    private TenantConfiguration defaultConfiguration(Tenant tenant) {
        TenantConfiguration configuration = TenantConfiguration.builder()
                .tenant(tenant)
                .brandName("Velo")
                .primaryColor("#2563EB")
                .riderLabel("Rider")
                .driverLabel("Driver")
                .tripLabel("Trip")
                .dispatchMode(DispatchMode.RIDE_HAILING)
                .build();
        return configuration;
    }

    private TenantBrandingDto toDto(TenantConfiguration config) {
        return TenantBrandingDto.builder()
                .tenantId(config.getTenant().getId())
                .brandName(config.getBrandName())
                .primaryColor(config.getPrimaryColor())
                .logoUrl(config.getLogoUrl())
                .riderLabel(config.getRiderLabel())
                .driverLabel(config.getDriverLabel())
                .tripLabel(config.getTripLabel())
                .dispatchMode(config.getDispatchMode())
                .riderPortalEnabled(config.getDispatchMode() != DispatchMode.DELIVERY_MERCHANT)
                .build();
    }
}
