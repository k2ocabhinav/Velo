package com.velo.platform.dto.admin;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminReasonRequestDto {
    @NotBlank(message = "Reason is required")
    private String reason;
}
