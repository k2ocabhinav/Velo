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
@Table(name = "tenant", indexes = {
        @Index(name = "idx_tenant_slug", columnList = "slug", unique = true)
})
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    /** IANA zone the tenant's wall clock is expressed in (e.g. "Asia/Kolkata"). */
    @Column(name = "time_zone", nullable = false, length = 64)
    @Builder.Default
    private String timeZone = "UTC";

    @Builder.Default
    @Column(name = "base_fare", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseFare = new BigDecimal("5.00");

    @Builder.Default
    @Column(name = "per_km_rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal perKmRate = new BigDecimal("2.00");

    @Builder.Default
    @Column(name = "minimum_fare", nullable = false, precision = 12, scale = 2)
    private BigDecimal minimumFare = BigDecimal.ZERO;

    @Column(name = "service_area_latitude")
    private Double serviceAreaLatitude;

    @Column(name = "service_area_longitude")
    private Double serviceAreaLongitude;

    @Column(name = "service_area_radius_km")
    private Double serviceAreaRadiusKm;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
