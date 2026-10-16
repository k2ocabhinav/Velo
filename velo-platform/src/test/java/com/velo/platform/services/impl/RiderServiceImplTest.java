package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
import com.velo.platform.configs.DispatchProperties;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.RideTrackingDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.*;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.DriverService;
import com.velo.platform.services.DriverEarningsService;
import com.velo.platform.services.GeocodingService;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.PaymentService;
import com.velo.platform.services.PromoCodeService;
import com.velo.platform.services.RatingService;
import com.velo.platform.services.RideOfferService;
import com.velo.platform.services.RideRealtimeService;
import com.velo.platform.services.RideService;
import com.velo.platform.services.WalletService;
import com.velo.platform.strategies.RideFareCalculationStrategy;
import com.velo.platform.strategies.DriverMatchingStrategy;
import com.velo.platform.strategies.RideStrategyManager;
import com.velo.platform.utils.GeometryUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RiderServiceImplTest {

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private RideStrategyManager rideStrategyManager;

    @Mock
    private RideRequestRepository rideRequestRepository;

    @Mock
    private RideRepository rideRepository;

    @Mock
    private RiderRepository riderRepository;

    @Mock
    private RideService rideService;

    @Mock
    private DriverService driverService;

    @Mock
    private RatingService ratingService;

    @Mock
    private PromoCodeService promoCodeService;

    @Mock
    private RideOfferService rideOfferService;

    @Mock
    private RideRealtimeService rideRealtimeService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantConfigurationRepository tenantConfigurationRepository;

    @Mock
    private PaymentService paymentService;

    @Mock
    private DriverEarningsService driverEarningsService;

    @Mock
    private WalletService walletService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private DispatchProperties dispatchProperties;

    @Mock
    private RideFareCalculationStrategy fareCalculationStrategy;

    @Mock
    private DriverMatchingStrategy driverMatchingStrategy;

    @Mock
    private SecurityContext securityContext;

    @Mock
    private Authentication authentication;

    @Mock
    private UserPrincipal userPrincipal;

    @Mock
    private GeocodingService geocodingService;

    private RiderServiceImpl riderService;

    private Rider testRider;
    private Ride testRide;
    private RideRequestDto testRideRequestDto;
    private RideRequest testRideRequest;

    @BeforeEach
    void setUp() {
        riderService = new RiderServiceImpl(
                modelMapper,
                rideStrategyManager,
                rideRequestRepository,
                rideRepository,
                riderRepository,
                rideService,
                driverService,
                ratingService,
                promoCodeService,
                rideOfferService,
                notificationService,
                tenantConfigurationRepository,
                paymentService,
                driverEarningsService,
                walletService,
                rideRealtimeService,
                new RideRequestAddressResolver(geocodingService),
                eventPublisher,
                dispatchProperties);
        lenient().when(tenantConfigurationRepository.findByTenant_Id(anyLong())).thenReturn(Optional.empty());

        User testUser = User.builder()
                .id(1L)
                .email("rider@test.com")
                .build();

        testRider = Rider.builder()
                .id(1L)
                .user(testUser)
                .rating(4.5)
                .build();

        PointDto pickupLocation = new PointDto(new double[]{40.7128, -74.0060});
        PointDto dropOffLocation = new PointDto(new double[]{40.7580, -73.9855});
        testRideRequestDto = new RideRequestDto();
        testRideRequestDto.setPickupLocation(pickupLocation);
        testRideRequestDto.setDropOffLocation(dropOffLocation);

        testRideRequest = RideRequest.builder()
                .id(1L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .rider(testRider)
                .fare(BigDecimal.valueOf(100.0))
                .build();

        Driver testDriver = Driver.builder()
                .id(1L)
                .build();

        testRide = Ride.builder()
                .id(1L)
                .rider(testRider)
                .driver(testDriver)
                .rideStatus(RideStatus.CONFIRMED)
                .fare(BigDecimal.valueOf(100.0))
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void mockAuthenticatedRider() {
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(userPrincipal);
        when(userPrincipal.getUserId()).thenReturn(101L);
        when(userPrincipal.getTenantId()).thenReturn(1L);
        lenient().when(riderRepository.findByUserIdAndTenantId(101L, 1L)).thenReturn(Optional.of(testRider));
        lenient().when(riderRepository.findByUserIdAndTenantIdForUpdate(101L, 1L)).thenReturn(Optional.of(testRider));
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    @DisplayName("Request ride should create ride request with fare and return")
    void requestRide_ShouldCreateRideRequestWithFare() {
        mockAuthenticatedRider();
        when(modelMapper.map(testRideRequestDto, RideRequest.class)).thenReturn(testRideRequest);
        when(rideStrategyManager.rideFareCalculationStrategy()).thenReturn(fareCalculationStrategy);
        when(fareCalculationStrategy.calculateFare(testRideRequest)).thenReturn(BigDecimal.valueOf(150.0));
        when(rideRequestRepository.save(testRideRequest)).thenReturn(testRideRequest);
        when(rideStrategyManager.driverMatchingStrategy(testRider.getRating())).thenReturn(driverMatchingStrategy);
        Driver matchedDriver = Driver.builder().id(10L).build();
        when(driverMatchingStrategy.findMatchingDrivers(testRideRequest)).thenReturn(List.of(matchedDriver));
        when(rideOfferService.createOffers(testRideRequest, List.of(matchedDriver))).thenReturn(List.of());
        when(modelMapper.map(testRideRequest, RideRequestDto.class)).thenReturn(testRideRequestDto);

        RideRequestDto result = riderService.requestRide(testRideRequestDto);

        assertThat(result).isNotNull();
        verify(rideRequestRepository).save(testRideRequest);
        assertThat(testRideRequest.getFare()).isEqualByComparingTo(BigDecimal.valueOf(150.0));
        verify(rideOfferService).createOffers(testRideRequest, List.of(matchedDriver));
        verify(eventPublisher).publishEvent(any());
    }

    @Test
    @DisplayName("Request ride exposes the offer expiry so the rider countdown matches dispatch")
    void requestRide_ShouldExposeOfferExpiryForPendingRequest() {
        mockAuthenticatedRider();
        RideRequest request = RideRequest.builder()
                .id(7L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .rider(testRider)
                .fare(BigDecimal.valueOf(100.0))
                .build();
        request.setRequestedTime(LocalDateTime.of(2026, 10, 16, 10, 0, 0));
        when(modelMapper.map(testRideRequestDto, RideRequest.class)).thenReturn(request);
        when(rideStrategyManager.rideFareCalculationStrategy()).thenReturn(fareCalculationStrategy);
        when(fareCalculationStrategy.calculateFare(request)).thenReturn(BigDecimal.valueOf(150.0));
        when(rideRequestRepository.save(request)).thenReturn(request);
        when(rideStrategyManager.driverMatchingStrategy(testRider.getRating())).thenReturn(driverMatchingStrategy);
        Driver matchedDriver = Driver.builder().id(10L).build();
        when(driverMatchingStrategy.findMatchingDrivers(request)).thenReturn(List.of(matchedDriver));
        when(rideOfferService.createOffers(request, List.of(matchedDriver))).thenReturn(List.of());
        RideRequestDto mappedDto = new RideRequestDto();
        when(modelMapper.map(request, RideRequestDto.class)).thenReturn(mappedDto);
        when(dispatchProperties.getOfferTtlSeconds()).thenReturn(90L);

        RideRequestDto result = riderService.requestRide(testRideRequestDto);

        assertThat(result.getExpiresAt()).isEqualTo(LocalDateTime.of(2026, 10, 16, 10, 1, 30).atOffset(java.time.ZoneOffset.UTC));
        assertThat(result.getRequestedTime()).isEqualTo(LocalDateTime.of(2026, 10, 16, 10, 0).atOffset(java.time.ZoneOffset.UTC));
    }

    @Test
    @DisplayName("Request ride fills address labels that the rider did not supply")
    void requestRide_WhenLabelsAreMissing_ShouldFillThemFromReverseGeocoding() {
        mockAuthenticatedRider();
        RideRequest request = rideRequestWithoutLabels();
        stubRequestRide(request);
        when(geocodingService.reverse(12.9716, 77.5946)).thenReturn(new GeocodingResultDto(
                "MG Road, Bengaluru", "MG Road, Bengaluru, Karnataka, India", 12.9716, 77.5946, "road"));
        when(geocodingService.reverse(12.9352, 77.6245)).thenReturn(new GeocodingResultDto(
                "Koramangala, Bengaluru", "Koramangala, Bengaluru, Karnataka, India", 12.9352, 77.6245, "suburb"));

        riderService.requestRide(testRideRequestDto);

        assertThat(request.getPickupAddress()).isEqualTo("MG Road, Bengaluru");
        assertThat(request.getDropOffAddress()).isEqualTo("Koramangala, Bengaluru");
    }

    @Test
    @DisplayName("Request ride keeps an empty label when reverse geocoding is unavailable")
    void requestRide_WhenGeocodingFails_ShouldKeepTheLabelEmptyAndStillCreateTheRequest() {
        mockAuthenticatedRider();
        RideRequest request = rideRequestWithoutLabels();
        stubRequestRide(request);
        when(geocodingService.reverse(anyDouble(), anyDouble())).thenThrow(new GeocodingUnavailableException());

        RideRequestDto result = riderService.requestRide(testRideRequestDto);

        assertThat(result).isNotNull();
        assertThat(request.getPickupAddress()).isNull();
        assertThat(request.getDropOffAddress()).isNull();
        verify(rideRequestRepository).save(request);
    }

    private RideRequest rideRequestWithoutLabels() {
        GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
        return RideRequest.builder()
                .id(2L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .pickupLocation(geometryFactory.createPoint(new Coordinate(77.5946, 12.9716)))
                .dropOffLocation(geometryFactory.createPoint(new Coordinate(77.6245, 12.9352)))
                .build();
    }

    private void stubRequestRide(RideRequest request) {
        when(modelMapper.map(testRideRequestDto, RideRequest.class)).thenReturn(request);
        when(rideStrategyManager.rideFareCalculationStrategy()).thenReturn(fareCalculationStrategy);
        when(fareCalculationStrategy.calculateFare(request)).thenReturn(BigDecimal.valueOf(150.0));
        when(rideRequestRepository.save(request)).thenReturn(request);
        when(rideStrategyManager.driverMatchingStrategy(testRider.getRating())).thenReturn(driverMatchingStrategy);
        Driver matchedDriver = Driver.builder().id(10L).build();
        when(driverMatchingStrategy.findMatchingDrivers(request)).thenReturn(List.of(matchedDriver));
        when(rideOfferService.createOffers(request, List.of(matchedDriver))).thenReturn(List.of());
        when(modelMapper.map(request, RideRequestDto.class)).thenReturn(testRideRequestDto);
    }

    @Test
    @DisplayName("Request ride rejects a rider who already has a pending request")
    void requestRide_WhenPendingRequestExists_ShouldRejectDuplicate() {
        mockAuthenticatedRider();
        when(rideRequestRepository.existsByRiderAndTenantIdAndRideRequestStatusIn(
                testRider,
                1L,
                List.of(RideRequestStatus.PENDING, RideRequestStatus.CONFIRMED)
        )).thenReturn(true);

        assertThatThrownBy(() -> riderService.requestRide(testRideRequestDto))
                .isInstanceOf(com.velo.platform.exceptions.RuntimeConflictException.class)
                .hasMessageContaining("already exists");

        verify(rideRequestRepository, never()).save(any(RideRequest.class));
        verify(rideStrategyManager, never()).rideFareCalculationStrategy();
    }

    @Test
    @DisplayName("Current ride request lookup is scoped to the authenticated rider tenant")
    void getCurrentRideRequest_ShouldReturnOnlyCurrentTenantRequest() {
        mockAuthenticatedRider();
        when(rideRequestRepository.findTopByRiderAndTenantIdAndRideRequestStatusInOrderByRequestedTimeDesc(
                testRider,
                1L,
                List.of(RideRequestStatus.PENDING, RideRequestStatus.CONFIRMED)
        )).thenReturn(Optional.of(testRideRequest));
        when(modelMapper.map(testRideRequest, RideRequestDto.class)).thenReturn(testRideRequestDto);

        RideRequestDto result = riderService.getCurrentRideRequest();

        assertThat(result).isSameAs(testRideRequestDto);
        verify(rideRequestRepository).findTopByRiderAndTenantIdAndRideRequestStatusInOrderByRequestedTimeDesc(
                testRider,
                1L,
                List.of(RideRequestStatus.PENDING, RideRequestStatus.CONFIRMED)
        );
    }

    @Test
    @DisplayName("Cancel ride by owner should cancel and make driver available")
    void cancelRide_ByOwner_ShouldCancelAndMakeDriverAvailable() {
        mockAuthenticatedRider();
        when(rideService.getRideById(1L)).thenReturn(testRide);
        when(rideService.updateRideStatus(testRide, RideStatus.CANCELLED)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());

        RideDto result = riderService.cancelRide(1L);

        assertThat(result).isNotNull();
        verify(rideService).updateRideStatus(testRide, RideStatus.CANCELLED);
        verify(driverService).updateDriverAvailability(testRide.getDriver(), true);
        verify(eventPublisher).publishEvent(any());
    }

    @Test
    @DisplayName("Cancel ride by non-owner should throw exception")
    void cancelRide_ByNonOwner_ShouldThrowException() {
        mockAuthenticatedRider();
        Rider otherRider = Rider.builder().id(99L).build();
        testRide.setRider(otherRider);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> riderService.cancelRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("does not own this ride");
    }

    @Test
    @DisplayName("Cancel ride with invalid status should throw exception")
    void cancelRide_WithInvalidStatus_ShouldThrowException() {
        mockAuthenticatedRider();
        testRide.setRideStatus(RideStatus.ENDED);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> riderService.cancelRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("cannot be cancelled");
    }

    @Test
    @DisplayName("Rate driver for ended ride should return driver dto")
    void rateDriver_ForEndedRide_ShouldReturnDriverDto() {
        mockAuthenticatedRider();
        testRide.setRideStatus(RideStatus.ENDED);

        when(rideService.getRideById(1L)).thenReturn(testRide);
        when(ratingService.rateDriver(testRide, 5)).thenReturn(new DriverDto());

        DriverDto result = riderService.rateDriver(1L, 5);

        assertThat(result).isNotNull();
        verify(ratingService).rateDriver(testRide, 5);
    }

    @Test
    @DisplayName("Rate driver for non-ended ride should throw exception")
    void rateDriver_ForNonEndedRide_ShouldThrowException() {
        mockAuthenticatedRider();
        testRide.setRideStatus(RideStatus.ONGOING);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> riderService.rateDriver(1L, 5))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("status is not Ended");
    }

    @Test
    @DisplayName("Rate driver by non-owner should throw exception")
    void rateDriver_ByNonOwner_ShouldThrowException() {
        mockAuthenticatedRider();
        Rider otherRider = Rider.builder().id(99L).build();
        testRide.setRider(otherRider);
        testRide.setRideStatus(RideStatus.ENDED);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> riderService.rateDriver(1L, 5))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not the owner");
    }

    @Test
    @DisplayName("Get my profile should return rider dto")
    void getMyProfile_ShouldReturnRiderDto() {
        mockAuthenticatedRider();
        when(modelMapper.map(testRider, RiderDto.class)).thenReturn(new RiderDto());

        RiderDto result = riderService.getMyProfile();

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("Get all my rides should return paginated rides")
    void getAllMyRides_ShouldReturnPaginatedRides() {
        mockAuthenticatedRider();
        Page<Ride> ridePage = new PageImpl<>(List.of(testRide));
        when(rideService.getAllRidesOfRider(testRider, PageRequest.of(0, 10))).thenReturn(ridePage);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());

        Page<RideDto> result = riderService.getAllMyRides(PageRequest.of(0, 10));

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    @DisplayName("Create new rider should save and return rider")
    void createNewRider_ShouldSaveAndReturnRider() {
        User testUser = User.builder().id(1L).build();

        when(riderRepository.save(any(Rider.class))).thenAnswer(invocation -> {
            Rider r = invocation.getArgument(0);
            r.setId(1L);
            return r;
        });

        Rider result = riderService.createNewRider(testUser);

        assertThat(result).isNotNull();
        assertThat(result.getRating()).isEqualTo(0.0);
        verify(riderRepository).save(any(Rider.class));
    }

    @Test
    @DisplayName("Get active ride tracking should return active ride details when confirmed ride exists")
    void getActiveRideTracking_WithConfirmedRide_ShouldReturnRideTracking() {
        mockAuthenticatedRider();

        User driverUser = User.builder().id(100L).firstName("Driver").build();
        Driver driver = Driver.builder()
                .id(22L)
                .user(driverUser)
                .vehicleId("KA01AB1234")
                .rating(4.8)
                .currentLocation(GeometryUtil.createPoint(new PointDto(new double[]{77.5946, 12.9716})))
                .build();
        Ride activeRide = Ride.builder()
                .id(44L)
                .rider(testRider)
                .driver(driver)
                .rideRequest(RideRequest.builder().id(91L).build())
                .rideStatus(RideStatus.CONFIRMED)
                .pickupLocation(GeometryUtil.createPoint(new PointDto(new double[]{77.585, 12.97})))
                .dropOffLocation(GeometryUtil.createPoint(new PointDto(new double[]{77.62, 12.94})))
                .createdTime(UtcTimes.now().minusMinutes(5))
                .build();

        when(rideRepository.findTopByRiderAndRideStatusInOrderByCreatedTimeDesc(
                testRider,
                List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)
        )).thenReturn(Optional.of(activeRide));

        RideTrackingDto trackingDto = riderService.getActiveRideTracking();

        assertThat(trackingDto).isNotNull();
        assertThat(trackingDto.getRideId()).isEqualTo(44L);
        assertThat(trackingDto.getRideRequestId()).isEqualTo(91L);
        assertThat(trackingDto.getStatus()).isEqualTo("CONFIRMED");
        assertThat(trackingDto.getDriver()).isNotNull();
        assertThat(trackingDto.getDriver().getVehicleId()).isEqualTo("KA01AB1234");
        assertThat(trackingDto.getLastDriverLocation()).isNotNull();
        assertThat(trackingDto.getCanCancel()).isTrue();
    }

    @Test
    @DisplayName("Get active ride tracking should return pending ride request when active ride is unavailable")
    void getActiveRideTracking_WithoutActiveRide_ShouldReturnPendingRequestTracking() {
        mockAuthenticatedRider();

        RideRequest pendingRequest = RideRequest.builder()
                .id(91L)
                .rider(testRider)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .pickupLocation(GeometryUtil.createPoint(new PointDto(new double[]{77.6, 12.96})))
                .dropOffLocation(GeometryUtil.createPoint(new PointDto(new double[]{77.62, 12.99})))
                .requestedTime(UtcTimes.now().minusMinutes(2))
                .build();

        when(rideRepository.findTopByRiderAndRideStatusInOrderByCreatedTimeDesc(
                testRider,
                List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)
        )).thenReturn(Optional.empty());
        when(rideRequestRepository.findTopByRiderAndRideRequestStatusInOrderByRequestedTimeDesc(
                testRider,
                List.of(RideRequestStatus.PENDING, RideRequestStatus.SCHEDULED)
        )).thenReturn(Optional.of(pendingRequest));

        RideTrackingDto trackingDto = riderService.getActiveRideTracking();

        assertThat(trackingDto).isNotNull();
        assertThat(trackingDto.getRideId()).isNull();
        assertThat(trackingDto.getRideRequestId()).isEqualTo(91L);
        assertThat(trackingDto.getStatus()).isEqualTo("PENDING");
        assertThat(trackingDto.getCanCancel()).isTrue();
    }
}
