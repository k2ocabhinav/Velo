package com.velo.platform.entities;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@Table(indexes = {
        @Index(name = "idx_ride_rider", columnList = "rider_id"),
        @Index(name = "idx_ride_driver", columnList = "driver_id"),
        @Index(name = "idx_ride_status", columnList = "rideStatus"),
        @Index(name = "idx_ride_created", columnList = "createdTime")
})
public class Ride{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private Long tenantId = 1L;

    @Column(columnDefinition = "Geometry(Point, 4326)")
    private Point pickupLocation;

    @Column(columnDefinition = "Geometry(Point, 4326)")
    private Point dropOffLocation;

    @CreationTimestamp
    private LocalDateTime createdTime;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    private Rider rider;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    private Driver driver;

    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    private RideStatus rideStatus;

    @Column(precision = 10, scale = 2)
    private java.math.BigDecimal fare;

    private String promoCode;

    @Column(precision = 10, scale = 2)
    private java.math.BigDecimal discountAmount;

    private String otp;

    @Column(name = "external_reference")
    private String externalReference;

    @ToString.Exclude
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ride_request_id", unique = true)
    private RideRequest rideRequest;

    @Version
    private Long version;

    @PrePersist
    private void applyDefaults() {
        if (tenantId == null && rider != null && rider.getTenantId() != null) {
            tenantId = rider.getTenantId();
        }
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
        if (!(o instanceof Ride that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
