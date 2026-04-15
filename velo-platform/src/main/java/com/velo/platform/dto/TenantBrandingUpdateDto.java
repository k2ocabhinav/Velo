package com.velo.platform.dto;

import com.velo.platform.entities.enums.DispatchMode;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantBrandingUpdateDto {
    @NotBlank
    private String brandName;
    @NotBlank
    private String primaryColor;
    private String logoUrl;
    @NotBlank
    private String riderLabel;
    @NotBlank
    private String driverLabel;
    @NotBlank
    private String tripLabel;
    private DispatchMode dispatchMode;
}
