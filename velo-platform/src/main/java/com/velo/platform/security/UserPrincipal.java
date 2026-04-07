package com.velo.platform.security;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.security.Principal;

@Getter
@Builder
@AllArgsConstructor
public class UserPrincipal implements Principal {
    private final Long userId;
    private final String email;
    private final String role;

    @Override
    public String getName() {
        return email;
    }
}
