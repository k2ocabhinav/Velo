package com.velo.platform.services;

import com.velo.platform.configs.FareConfig;
import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class TenantTariffService {
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.UNNECESSARY);

    private final TenantRepository tenantRepository;
    private final FareConfig fareConfig;

    @Transactional(readOnly = true)
    public Tariff findForTenant(Long tenantId) {
        Tenant tenant = tenantId == null ? null : tenantRepository.findById(tenantId).orElse(null);
        BigDecimal baseFare = tenant == null || tenant.getBaseFare() == null
                ? BigDecimal.valueOf(fareConfig.getBaseFare()) : tenant.getBaseFare();
        BigDecimal perKmRate = tenant == null || tenant.getPerKmRate() == null
                ? BigDecimal.valueOf(fareConfig.getPerKmRate()) : tenant.getPerKmRate();
        BigDecimal minimumFare = tenant == null || tenant.getMinimumFare() == null
                ? ZERO : tenant.getMinimumFare();
        return new Tariff(baseFare, perKmRate, minimumFare);
    }

    public record Tariff(BigDecimal baseFare, BigDecimal perKmRate, BigDecimal minimumFare) {
        public BigDecimal calculate(double distanceKm, BigDecimal multiplier) {
            BigDecimal distance = BigDecimal.valueOf(distanceKm);
            BigDecimal amount = baseFare.add(distance.multiply(perKmRate))
                    .max(minimumFare)
                    .multiply(multiplier);
            return amount.setScale(2, RoundingMode.HALF_UP);
        }
    }
}
