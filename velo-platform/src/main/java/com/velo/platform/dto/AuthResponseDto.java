package com.velo.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponseDto {
    private String token;
    private String refreshToken;
    private Long expiresInSeconds;
    private Long userId;
    private String email;
    private String role;
    private Long tenantId;
}
