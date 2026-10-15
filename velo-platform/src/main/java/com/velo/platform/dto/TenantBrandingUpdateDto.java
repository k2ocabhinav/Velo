package com.velo.platform.dto;

import com.velo.platform.entities.enums.DispatchMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Primary color must be a six-digit hex color such as #1A2B3C")
    private String primaryColor;
    private String logoUrl;
    @NotBlank
    private String riderLabel;
    @NotBlank
    private String driverLabel;
    @NotBlank
    private String tripLabel;
    @Pattern(regexp = "^[A-Z]{3}$", message = "Currency must be a three-letter ISO code such as USD or INR")
    private String currency;
    private DispatchMode dispatchMode;
}
