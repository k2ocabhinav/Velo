package com.velo.platform.entities;

import com.velo.platform.entities.enums.PayoutStatus;
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
// Hot path: driver payout history and pending payout queues.
@Table(indexes = {
        @Index(name = "idx_payout_driver", columnList = "driver_id"),
        @Index(name = "idx_payout_status", columnList = "status"),
        @Index(name = "idx_payout_driver_requested", columnList = "driver_id,requestedAt"),
        @Index(name = "idx_payout_status_requested", columnList = "status,requestedAt")
})
public class PayoutRequest {

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

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PayoutStatus status;

    @CreationTimestamp
    private LocalDateTime requestedAt;

    private LocalDateTime processedAt;

    private String adminNote;

    @Version
    private Long version;

    @PrePersist
    private void applyDefaults() {
        if (tenantId == null && driver != null && driver.getTenantId() != null) {
            tenantId = driver.getTenantId();
        }
        if (tenantId == null) {
            tenantId = 1L;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PayoutRequest that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
