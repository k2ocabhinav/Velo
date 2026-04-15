package com.velo.platform.entities;

import com.velo.platform.entities.enums.DispatchMode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "tenant_configuration")
public class TenantConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false, unique = true)
    private Tenant tenant;

    @Column(name = "brand_name", nullable = false)
    @Builder.Default
    private String brandName = "Velo";

    @Column(name = "primary_color", nullable = false, length = 16)
    @Builder.Default
    private String primaryColor = "#2563EB";

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "rider_label", nullable = false, length = 64)
    @Builder.Default
    private String riderLabel = "Rider";

    @Column(name = "driver_label", nullable = false, length = 64)
    @Builder.Default
    private String driverLabel = "Driver";

    @Column(name = "trip_label", nullable = false, length = 64)
    @Builder.Default
    private String tripLabel = "Trip";

    @Enumerated(EnumType.STRING)
    @Column(name = "dispatch_mode", nullable = false, length = 32)
    @Builder.Default
    private DispatchMode dispatchMode = DispatchMode.RIDE_HAILING;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
