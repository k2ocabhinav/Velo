package com.velo.platform.services.impl;

import com.velo.platform.configs.FareConfig;
import com.velo.platform.dto.FareEstimateDto;
import com.velo.platform.dto.FareEstimateRequestDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.PromoCodeResultDto;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.Wallet;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.services.DistanceService;
import com.velo.platform.services.PromoCodeService;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.WalletService;
import com.velo.platform.strategies.RideFareCalculationStrategy;
import com.velo.platform.strategies.RideStrategyManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Point;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.math.BigDecimal;
import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FareEstimationServiceImplTest {

    @Mock
    private DistanceService distanceService;

    @Mock
    private RideStrategyManager rideStrategyManager;

    @Mock
    private RideFareCalculationStrategy fareCalculationStrategy;

    @Mock
    private PromoCodeService promoCodeService;

    @Mock
    private RiderService riderService;

    @Mock
    private WalletService walletService;

    private FareConfig fareConfig;
    private ModelMapper modelMapper;
    private FareEstimationServiceImpl fareEstimationService;

    private FareEstimateRequestDto requestDto;
    private User testUser;
    private Rider testRider;

    @BeforeEach
    void setUp() {
        fareConfig = new FareConfig();
        fareConfig.setPerKmRate(10.0);
        fareConfig.setSurgeMultiplier(1.5);
        
        modelMapper = new com.velo.platform.configs.MapperConfig().modelMapper();
        fareEstimationService = new FareEstimationServiceImpl(
                distanceService, rideStrategyManager, promoCodeService, 
                riderService, walletService, fareConfig, modelMapper);
        
        requestDto = new FareEstimateRequestDto();
        requestDto.setPickupLocation(new PointDto(new double[]{77.123, 28.123}));
        requestDto.setDropOffLocation(new PointDto(new double[]{77.456, 28.456}));
        requestDto.setPaymentMethod(PaymentMethod.CASH);
        
        testUser = User.builder().id(1L).build();
        testRider = Rider.builder().id(1L).user(testUser).build();
    }

    @Test
    @DisplayName("Estimate fare should return valid estimate without promo")
    void estimateFare_WithoutPromo_ShouldReturnValidEstimate() {
        // Arrange
        when(distanceService.calculateDistanceAndDuration(any(Point.class), any(Point.class)))
                .thenReturn(new double[]{10.5, 25.6});
        when(rideStrategyManager.rideFareCalculationStrategy()).thenReturn(fareCalculationStrategy);
        when(fareCalculationStrategy.calculateFare(any(RideRequest.class))).thenReturn(BigDecimal.valueOf(150.0));
        when(riderService.getCurrentRider()).thenReturn(testRider);
        when(walletService.findByUser(testUser)).thenReturn(Wallet.builder().balance(BigDecimal.valueOf(500.0)).build());
        when(promoCodeService.getActivePromoCodes()).thenReturn(Collections.emptyList());

        // Act
        FareEstimateDto result = fareEstimationService.estimateFare(requestDto);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getBaseFare()).isEqualByComparingTo(BigDecimal.valueOf(5.0));
        assertThat(result.getEstimatedFare()).isEqualByComparingTo(BigDecimal.valueOf(150.0));
        assertThat(result.getDiscountAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.getDistanceKm()).isEqualTo(10.5);
        assertThat(result.getDurationMinutes()).isEqualTo(26);
        assertThat(result.getSurgeMultiplier()).isEqualTo(1.5);
        verify(promoCodeService, never()).previewPromo(anyString(), any(), any());
    }

    @Test
    @DisplayName("Estimate fare should apply valid promo code")
    void estimateFare_WithValidPromo_ShouldApplyDiscount() {
        // Arrange
        requestDto.setPromoCode("SAVE50");
        when(distanceService.calculateDistanceAndDuration(any(Point.class), any(Point.class)))
                .thenReturn(new double[]{10.0, 20.0});
        when(rideStrategyManager.rideFareCalculationStrategy()).thenReturn(fareCalculationStrategy);
        when(fareCalculationStrategy.calculateFare(any(RideRequest.class))).thenReturn(BigDecimal.valueOf(100.0));
        
        when(riderService.getCurrentRider()).thenReturn(testRider);
        when(walletService.findByUser(testUser)).thenReturn(Wallet.builder().balance(BigDecimal.valueOf(500.0)).build());
        
        PromoCodeResultDto promoResult = new PromoCodeResultDto();
        promoResult.setValid(true);
        promoResult.setDiscountAmount(BigDecimal.valueOf(50.0));
        promoResult.setDiscountedFare(BigDecimal.valueOf(50.0));
        
        when(promoCodeService.previewPromo(eq("SAVE50"), eq(testUser), any(BigDecimal.class)))
                .thenReturn(promoResult);
        when(promoCodeService.getActivePromoCodes()).thenReturn(Collections.emptyList());

        // Act
        FareEstimateDto result = fareEstimationService.estimateFare(requestDto);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getBaseFare()).isEqualByComparingTo(BigDecimal.valueOf(5.0));
        assertThat(result.getDiscountAmount()).isEqualByComparingTo(BigDecimal.valueOf(50.0));
        assertThat(result.getEstimatedFare()).isEqualByComparingTo(BigDecimal.valueOf(50.0));
    }
}
