package com.velo.platform.services.impl;

import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.TenantScopeService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class TenantScopeServiceImpl implements TenantScopeService {

    @Override
    public Long requireCurrentTenantId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null
                ? null
                : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserPrincipal userPrincipal)) {
            throw new RuntimeConflictException("Unable to resolve tenant context for current request.");
        }
        if (userPrincipal.getTenantId() == null) {
            throw new RuntimeConflictException("Tenant context missing in auth token.");
        }
        return userPrincipal.getTenantId();
    }
}
