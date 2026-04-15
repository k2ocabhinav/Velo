package com.velo.platform.entities;

import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
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
// Hot path: scheduled-ride queues and rider history.
@Table(
        indexes = {
                @Index(name = "idx_ride_request_rider", columnList = "rider_id"),
                @Index(name = "idx_ride_request_status", columnList = "rideRequestStatus"),
                @Index(name = "idx_ride_request_scheduled", columnList = "scheduledTime"),
                @Index(name = "idx_ride_request_rider_status_scheduled", columnList = "rider_id,rideRequestStatus,scheduledTime"),
                @Index(name = "idx_ride_request_status_scheduled", columnList = "rideRequestStatus,scheduledTime")
        }
)
public class RideRequest {

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

    @Column(name = "customer_name")
    private String customerName;

    @Column(name = "customer_phone")
    private String customerPhone;

    @Column(name = "pickup_address")
    private String pickupAddress;

    @Column(name = "drop_off_address")
    private String dropOffAddress;

    @Column(name = "external_reference")
    private String externalReference;

    @CreationTimestamp
    private LocalDateTime requestedTime;

    private LocalDateTime scheduledTime;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    private Rider rider;

    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    private RideRequestStatus rideRequestStatus;

    @Column(precision = 10, scale = 2)
    private java.math.BigDecimal fare;

    private String promoCode;

    @Column(precision = 10, scale = 2)
    private java.math.BigDecimal discountAmount;

    @Version
    private Long version;

    @PrePersist
    private void applyDefaults() {
        if (tenantId == null && rider != null && rider.getTenantId() != null) {
            tenantId = rider.getTenantId();
        }
        if (tenantId == null) {
            tenantId = 1L;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RideRequest that)) return false;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
