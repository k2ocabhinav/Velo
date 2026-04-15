package com.velo.platform.entities;

import com.velo.platform.entities.enums.AdminDispatchActionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(indexes = {
        @Index(name = "idx_dispatch_audit_request_created", columnList = "ride_request_id,created_at"),
        @Index(name = "idx_dispatch_audit_ride_created", columnList = "ride_id,created_at"),
        @Index(name = "idx_dispatch_audit_tenant_created", columnList = "tenant_id,created_at"),
        @Index(name = "idx_dispatch_audit_created", columnList = "created_at")
})
public class AdminDispatchAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private AdminDispatchActionType actionType;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ride_request_id")
    private RideRequest rideRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ride_id")
    private Ride ride;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_driver_id")
    private Driver previousDriver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "next_driver_id")
    private Driver nextDriver;

    @Column(nullable = false)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
