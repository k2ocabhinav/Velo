package com.velo.platform.dto;

import com.velo.platform.entities.enums.DispatchMode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantBrandingDto {
    private Long tenantId;
    private String brandName;
    private String primaryColor;
    private String logoUrl;
    private String riderLabel;
    private String driverLabel;
    private String tripLabel;
    @Builder.Default
    private String currency = "USD";
    private DispatchMode dispatchMode;
    private boolean riderPortalEnabled;
}
