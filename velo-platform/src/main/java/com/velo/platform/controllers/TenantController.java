package com.velo.platform.controllers;

import com.velo.platform.dto.TenantBrandingDto;
import com.velo.platform.dto.TenantBrandingUpdateDto;
import com.velo.platform.services.TenantConfigurationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
@Tag(name = "Tenant", description = "Tenant branding, labels, and dispatch mode configuration")
@SecurityRequirement(name = "bearerAuth")
public class TenantController {

    private final TenantConfigurationService tenantConfigurationService;

    @GetMapping("/public/tenant/branding")
    @Operation(summary = "Get tenant branding and labels for public entry points")
    public ResponseEntity<TenantBrandingDto> getPublicTenantBranding(
            @RequestParam(defaultValue = "default") String tenant
    ) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=60, stale-while-revalidate=60")
                .body(tenantConfigurationService.getBrandingByTenantSlug(tenant));
    }

    @GetMapping("/tenant/branding")
    @Operation(summary = "Get the current tenant branding and label configuration")
    public ResponseEntity<TenantBrandingDto> getCurrentTenantBranding() {
        return ResponseEntity.ok(tenantConfigurationService.getCurrentTenantBranding());
    }

    @GetMapping("/admin/branding")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get branding settings in admin workspace")
    public ResponseEntity<TenantBrandingDto> getAdminBranding() {
        return ResponseEntity.ok(tenantConfigurationService.getCurrentTenantBranding());
    }

    @PutMapping("/admin/branding")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update branding settings in admin workspace")
    public ResponseEntity<TenantBrandingDto> updateBranding(@Valid @RequestBody TenantBrandingUpdateDto updateDto) {
        return ResponseEntity.ok(tenantConfigurationService.updateCurrentTenantBranding(updateDto));
    }
}
