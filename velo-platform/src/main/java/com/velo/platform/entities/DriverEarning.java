package com.velo.platform.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(indexes = {
        @Index(name = "idx_earning_driver", columnList = "driver_id"),
        @Index(name = "idx_earning_created", columnList = "createdTime")
})
public class DriverEarning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private Long tenantId = 1L;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    @ToString.Exclude
    private Driver driver;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    @ToString.Exclude
    private Ride ride;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal grossFare;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal platformCommission;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal netEarning;

    @CreationTimestamp
    private LocalDateTime createdTime;

    @Version
    private Long version;

    @PrePersist
    private void applyDefaults() {
        if (tenantId == null && driver != null && driver.getTenantId() != null) {
            tenantId = driver.getTenantId();
        }
        if (tenantId == null && ride != null && ride.getTenantId() != null) {
            tenantId = ride.getTenantId();
        }
        if (tenantId == null) {
            tenantId = 1L;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DriverEarning that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
