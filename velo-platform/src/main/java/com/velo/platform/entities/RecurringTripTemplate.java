package com.velo.platform.entities;

import com.velo.platform.entities.enums.PaymentMethod;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "recurring_trip_template", indexes = {
        @Index(name = "idx_recurring_template_tenant_active", columnList = "tenant_id,active"),
        @Index(name = "idx_recurring_template_rider", columnList = "rider_id,tenant_id")
})
public class RecurringTripTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rider_id", nullable = false)
    private Rider rider;

    @Column(name = "days_of_week", nullable = false, length = 64)
    private String daysOfWeek;

    @Column(name = "local_time", nullable = false)
    private LocalTime localTime;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "pickup_location", columnDefinition = "Geometry(Point, 4326)", nullable = false)
    private Point pickupLocation;

    @Column(name = "drop_off_location", columnDefinition = "Geometry(Point, 4326)", nullable = false)
    private Point dropOffLocation;

    @Column(name = "pickup_address", length = 1024)
    private String pickupAddress;

    @Column(name = "drop_off_address", length = 1024)
    private String dropOffAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 32)
    private PaymentMethod paymentMethod;

    @Column(length = 1024)
    private String notes;

    @Column(name = "booking_reference")
    private String bookingReference;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    public Set<DayOfWeek> getDays() {
        if (daysOfWeek == null || daysOfWeek.isBlank()) return EnumSet.noneOf(DayOfWeek.class);
        return Stream.of(daysOfWeek.split(","))
                .map(String::trim)
                .map(DayOfWeek::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));
    }

    public void setDays(Set<DayOfWeek> days) {
        this.daysOfWeek = days.stream().sorted().map(DayOfWeek::name).collect(Collectors.joining(","));
    }
}
