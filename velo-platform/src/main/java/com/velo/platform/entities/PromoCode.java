package com.velo.platform.entities;

import com.velo.platform.entities.enums.DiscountType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
// Hot path: active promo lookup.
@Table(name = "promo_code", indexes = {
        @Index(name = "idx_promo_code_active", columnList = "active")
})
public class PromoCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType discountType;

    @Column(nullable = false)
    private BigDecimal discountValue;

    private Integer maxUses;

    private Integer currentUses;

    private LocalDate startDate;

    private LocalDate endDate;

    private BigDecimal minRideFare;

    private Boolean active;

    private String description;
}
