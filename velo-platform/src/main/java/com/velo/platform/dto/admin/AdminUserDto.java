package com.velo.platform.dto.admin;

import com.velo.platform.entities.enums.Role;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;
import java.util.Set;

@Value
@Builder
public class AdminUserDto {
    Long id;
    String firstName;
    String lastName;
    String email;
    String phoneNumber;
    Boolean active;
    Long tenantId;
    String referralCode;
    LocalDateTime createdTime;
    Set<Role> roles;
}
