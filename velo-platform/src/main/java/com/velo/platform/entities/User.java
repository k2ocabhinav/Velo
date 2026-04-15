package com.velo.platform.entities;

import com.velo.platform.entities.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Getter
@Setter
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "app_user", indexes = {
        @Index(name = "idx_user_email", columnList = "email"),
        @Index(name = "idx_user_referral_code", columnList = "referral_code", unique = true)
})
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String firstName;
    private String lastName;

    @Column(unique = true)
    private String email;
    private String password;
    private String phoneNumber;
    @Builder.Default
    private Boolean active = Boolean.TRUE;
    @Builder.Default
    @Column(name = "tenant_id", nullable = false)
    private Long tenantId = 1L;

    @Column(unique = true)
    private String referralCode;

    @CreationTimestamp
    private LocalDateTime createdTime;

    @ElementCollection(fetch = FetchType.LAZY)
    @Enumerated(EnumType.STRING)
    private Set<Role> roles;

    @Version
    private Long version;

    @PrePersist
    void applyDefaults() {
        if (active == null) {
            active = Boolean.TRUE;
        }
        if (tenantId == null) {
            tenantId = 1L;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof User that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

}
