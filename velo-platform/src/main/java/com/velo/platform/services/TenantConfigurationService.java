package com.velo.platform.services;

import com.velo.platform.dto.TenantBrandingDto;
import com.velo.platform.dto.TenantBrandingUpdateDto;

public interface TenantConfigurationService {
    TenantBrandingDto getBrandingByTenantSlug(String tenantSlug);
    TenantBrandingDto getCurrentTenantBranding();
    TenantBrandingDto updateCurrentTenantBranding(TenantBrandingUpdateDto updateDto);
}
