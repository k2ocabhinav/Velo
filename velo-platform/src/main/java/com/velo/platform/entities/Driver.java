package com.velo.platform.entities;

import com.velo.platform.entities.enums.DriverOnboardingStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(indexes = {
        @Index(name = "idx_driver_vehicle_id", columnList = "vehicleId"),
        @Index(name = "idx_driver_available", columnList = "available"),
        @Index(name = "idx_driver_rating", columnList = "rating"),
        @Index(name = "idx_driver_onboarding_status", columnList = "onboardingStatus")
})
public class Driver {
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

    private String vehicleId;
    private Double rating;
    private Boolean available;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DriverOnboardingStatus onboardingStatus = DriverOnboardingStatus.PENDING;

    /** Reason an administrator gave when rejecting the application, shown back to the driver. */
    @Column(name = "rejection_reason", length = 1024)
    private String rejectionReason;

    @Column(columnDefinition = "Geometry(Point, 4326)")
    private Point currentLocation;

    @Column(name = "location_updated_at")
    private LocalDateTime locationUpdatedAt;

    @Column(name = "location_heading")
    private Double locationHeading;

    @Column(name = "location_speed_kph")
    private Double locationSpeedKph;

    @CreationTimestamp
    private LocalDateTime createdAt;

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
        if (!(o instanceof Driver that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

}
