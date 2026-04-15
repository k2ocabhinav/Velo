package com.velo.platform.entities;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(indexes = {
        @Index(name = "idx_rider_rating", columnList = "rating")
})
public class Rider {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private Long tenantId = 1L;
    private Double rating;

    @Version
    private Long version;

    @PrePersist
    private void applyDefaults() {
        if (tenantId == null && user != null && user.getTenantId() != null) {
            tenantId = user.getTenantId();
        }
        if (tenantId == null) {
            tenantId = 1L;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Rider that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

}
