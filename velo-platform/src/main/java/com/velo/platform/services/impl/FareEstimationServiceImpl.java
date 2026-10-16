package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.configs.FareConfig;
import com.velo.platform.dto.FareEstimateDto;
import com.velo.platform.dto.FareEstimateRequestDto;
import com.velo.platform.dto.PromoCodeResultDto;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.services.DistanceService;
import com.velo.platform.services.FareEstimationService;
import com.velo.platform.services.PromoCodeService;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.TenantTariffService;
import com.velo.platform.services.WalletService;
import com.velo.platform.strategies.RideStrategyManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Point;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class FareEstimationServiceImpl implements FareEstimationService {

    private final DistanceService distanceService;
    private final RideStrategyManager rideStrategyManager;
    private final PromoCodeService promoCodeService;
    private final RiderService riderService;
    private final WalletService walletService;
    private final FareConfig fareConfig;
    private final TenantTariffService tenantTariffService;
    private final ModelMapper modelMapper;

    @Override
    public FareEstimateDto estimateFare(FareEstimateRequestDto fareEstimateRequestDto) {
        RideRequest dummyRideRequest = modelMapper.map(fareEstimateRequestDto, RideRequest.class);
        Rider rider = riderService.getCurrentRider();
        dummyRideRequest.setTenantId(rider.getTenantId());
        TenantTariffService.Tariff tariff = tenantTariffService.findForTenant(rider.getTenantId());
        
        Point pickupPoint = dummyRideRequest.getPickupLocation();
        Point dropOffPoint = dummyRideRequest.getDropOffLocation();
        
        double[] distanceDuration = distanceService.calculateDistanceAndDuration(pickupPoint, dropOffPoint);
        double distanceKm = distanceDuration[0];
        double durationMins = distanceDuration[1];
        
        BigDecimal originalFare = rideStrategyManager.rideFareCalculationStrategy().calculateFare(dummyRideRequest);
        BigDecimal finalFare = originalFare;
        BigDecimal discountAmount = BigDecimal.ZERO;
        boolean promoApplied = false;
        String promoMessage = null;
        String promoCode = fareEstimateRequestDto.getPromoCode();
        if (promoCode != null && !promoCode.isBlank()) {
            try {
                PromoCodeResultDto promoResult = promoCodeService.previewPromo(promoCode, rider.getUser(), originalFare);
                if (promoResult.isValid()) {
                    discountAmount = promoResult.getDiscountAmount();
                    finalFare = promoResult.getDiscountedFare();
                    promoApplied = true;
                }
                promoMessage = promoResult.getMessage();
            } catch (Exception e) {
                log.warn("Could not apply promo code for estimate: {}", e.getMessage());
                promoMessage = e.getMessage();
            }
        }

        BigDecimal walletBalance = null;
        Boolean walletSufficient = null;
        try {
            Wallet wallet = walletService.findByUser(rider.getUser());
            walletBalance = wallet.getBalance();
            if (fareEstimateRequestDto.getPaymentMethod() == PaymentMethod.WALLET) {
                walletSufficient = walletBalance.compareTo(finalFare) >= 0;
            } else {
                walletSufficient = true;
            }
        } catch (Exception ignored) {
            walletSufficient = fareEstimateRequestDto.getPaymentMethod() == PaymentMethod.WALLET ? Boolean.FALSE : Boolean.TRUE;
        }
        
        return FareEstimateDto.builder()
                .estimatedFare(finalFare)
                .baseFare(tariff.baseFare())
                .originalFare(originalFare)
                .discountedFare(finalFare)
                .savings(discountAmount)
                .promoApplied(promoApplied)
                .promoMessage(promoMessage)
                .surgeMultiplier(fareConfig.getSurgeMultiplier()) // Or dynamic if implemented
                .discountAmount(discountAmount)
                .distanceKm(distanceKm)
                .durationMinutes(Math.toIntExact(Math.round(durationMins)))
                .walletSufficient(walletSufficient)
                .estimatedPickupTime(UtcTimes.now().plusMinutes(10)) // Static stub for v1.1.0
                .applicablePromos(promoCodeService.getActivePromoCodes())
                .build();
    }
}
