package com.velo.platform.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdminDispatchActionRequestDto {
    @NotNull(message = "Driver ID is required")
    private Long driverId;

    @NotBlank(message = "Reason is required")
    private String reason;
}
