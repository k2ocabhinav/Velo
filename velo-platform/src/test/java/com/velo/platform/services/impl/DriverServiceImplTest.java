package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.DriverLocationDto;
import com.velo.platform.dto.DriverLocationUpdateRequestDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RideRequestDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.RideOfferStatus;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.PaymentService;
import com.velo.platform.services.RatingService;
import com.velo.platform.services.RideRequestService;
import com.velo.platform.services.RideRealtimeService;
import com.velo.platform.services.RideOfferService;
import com.velo.platform.services.RideService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DriverServiceImplTest {

    @Mock
    private RideRequestService rideRequestService;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private RideRepository rideRepository;

    @Mock
    private RideRequestRepository rideRequestRepository;

    @Mock
    private RideService rideService;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private PaymentService paymentService;

    @Mock
    private RatingService ratingService;

    @Mock
    private com.velo.platform.services.DriverEarningsService driverEarningsService;

    @Mock
    private SecurityContext securityContext;

    @Mock
    private Authentication authentication;

    @Mock
    private UserPrincipal userPrincipal;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private RideRealtimeService rideRealtimeService;

    @Mock
    private RideOfferService rideOfferService;

    private DriverServiceImpl driverService;

    private Driver testDriver;
    private RideRequest testRideRequest;
    private Ride testRide;

    @BeforeEach
    void setUp() {
        driverService = new DriverServiceImpl(
                rideRequestService,
                driverRepository,
                rideRepository,
                rideRequestRepository,
                rideService,
                modelMapper,
                paymentService,
                ratingService,
                driverEarningsService,
                eventPublisher,
                rideRealtimeService,
                rideOfferService);

        testDriver = Driver.builder()
                .id(1L)
                .vehicleId("VEH123")
                .rating(4.5)
                .available(true)
                .build();

        testRideRequest = RideRequest.builder()
                .id(1L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .fare(BigDecimal.valueOf(100.0))
                .build();

        testRide = Ride.builder()
                .id(1L)
                .driver(testDriver)
                .rideStatus(RideStatus.CONFIRMED)
                .otp("1234")
                .fare(BigDecimal.valueOf(100.0))
                .paymentMethod(PaymentMethod.CASH)
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void mockAuthenticatedDriver() {
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(userPrincipal);
        when(userPrincipal.getUserId()).thenReturn(101L);
        when(userPrincipal.getTenantId()).thenReturn(1L);
        when(driverRepository.findByUserIdAndTenantId(101L, 1L)).thenReturn(Optional.of(testDriver));
        lenient().when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(rideOfferService.hasAnyOffer(anyLong())).thenReturn(false);
        lenient().when(rideRequestRepository.compareAndSetStatus(anyLong(), anyLong(), any(), any())).thenReturn(1);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    @DisplayName("Accept ride should create ride and set driver unavailable")
    void acceptRide_WithPendingRequest_ShouldCreateRideAndSetUnavailable() {
        mockAuthenticatedDriver();
        when(rideRequestService.findRideRequestById(1L)).thenReturn(testRideRequest);
        when(rideService.createNewRide(testRideRequest, testDriver)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());

        RideDto result = driverService.acceptRide(1L);

        assertThat(result).isNotNull();
        verify(rideService).createNewRide(testRideRequest, testDriver);
        verify(driverRepository).save(testDriver);
        assertThat(testDriver.getAvailable()).isFalse();
    }

    @Test
    @DisplayName("Accepted ride includes the rider name and fare in its DTO")
    void acceptRide_WithRider_ShouldReturnNameAndFare() {
        mockAuthenticatedDriver();
        Rider rider = Rider.builder()
                .id(12L)
                .user(User.builder().firstName("Henry").lastName("Rider").build())
                .build();
        testRide.setRider(rider);
        UserDto userDto = new UserDto();
        RiderDto riderDto = new RiderDto();
        riderDto.setUser(userDto);
        RideDto rideDto = new RideDto();
        rideDto.setFare(100.0);
        rideDto.setRider(riderDto);

        when(rideRequestService.findRideRequestById(1L)).thenReturn(testRideRequest);
        when(rideService.createNewRide(testRideRequest, testDriver)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(rideDto);

        RideDto result = driverService.acceptRide(1L);

        assertThat(result.getFare()).isEqualTo(100.0);
        assertThat(result.getRider().getUser().getName()).isEqualTo("Henry Rider");
    }

    @Test
    @DisplayName("Accept ride with offer lifecycle should mark accepted and revoke competing offers")
    void acceptRide_WithOfferLifecycle_ShouldResolveOfferStates() {
        mockAuthenticatedDriver();
        RideOffer offer = RideOffer.builder()
                .id(11L)
                .rideRequest(testRideRequest)
                .driver(testDriver)
                .status(RideOfferStatus.OFFERED)
                .build();

        when(rideRequestService.findRideRequestById(1L)).thenReturn(testRideRequest);
        when(rideOfferService.hasAnyOffer(1L)).thenReturn(true);
        when(rideOfferService.findAcceptableOffer(1L, testDriver.getId())).thenReturn(Optional.of(offer));
        when(rideService.createNewRide(testRideRequest, testDriver)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());

        RideDto result = driverService.acceptRide(1L);

        assertThat(result).isNotNull();
        verify(rideOfferService).markAccepted(offer);
        verify(rideOfferService).revokeCompetingOffers(1L, testDriver.getId(), "Ride accepted by another driver.");
    }

    @Test
    @DisplayName("Accept ride with non-pending status should throw exception")
    void acceptRide_WithNonPendingStatus_ShouldThrowException() {
        mockAuthenticatedDriver();
        testRideRequest.setRideRequestStatus(RideRequestStatus.CANCELLED);

        when(rideRequestService.findRideRequestById(1L)).thenReturn(testRideRequest);

        assertThatThrownBy(() -> driverService.acceptRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("already been assigned or cancelled");
    }

    @Test
    @DisplayName("Ride request preview returns stale status without a conflict")
    void getRideRequestForAcceptance_WithExpiredRequest_ShouldReturnStatus() {
        mockAuthenticatedDriver();
        testRideRequest.setRideRequestStatus(RideRequestStatus.EXPIRED);
        RideRequestDto preview = new RideRequestDto();
        preview.setRideRequestStatus(RideRequestStatus.EXPIRED);

        when(rideRequestService.findRideRequestById(1L)).thenReturn(testRideRequest);
        when(modelMapper.map(testRideRequest, RideRequestDto.class)).thenReturn(preview);

        RideRequestDto result = driverService.getRideRequestForAcceptance(1L);

        assertThat(result.getRideRequestStatus()).isEqualTo(RideRequestStatus.EXPIRED);
        verify(rideOfferService, never()).hasAnyOffer(1L);
    }

    @Test
    @DisplayName("Accept ride when driver unavailable should throw exception")
    void acceptRide_WhenDriverUnavailable_ShouldThrowException() {
        mockAuthenticatedDriver();
        testDriver.setAvailable(false);

        when(rideRequestService.findRideRequestById(1L)).thenReturn(testRideRequest);

        assertThatThrownBy(() -> driverService.acceptRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("unavailability");
    }

    @Test
    @DisplayName("Cancel ride should update status and make driver available")
    void cancelRide_WithConfirmedStatus_ShouldCancelAndMakeAvailable() {
        mockAuthenticatedDriver();
        testDriver.setAvailable(false);
        testRide.setRideStatus(RideStatus.CONFIRMED);

        when(rideService.getRideById(1L)).thenReturn(testRide);
        when(rideService.updateRideStatus(testRide, RideStatus.CANCELLED)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());
        when(modelMapper.map(testDriver, DriverDto.class)).thenReturn(new DriverDto());

        RideDto result = driverService.cancelRide(1L);

        assertThat(result).isNotNull();
        verify(rideService).updateRideStatus(testRide, RideStatus.CANCELLED);
        verify(driverRepository).updateAvailabilityById(testDriver.getId(), true);
        verify(driverRepository, never()).save(any(Driver.class));
    }

    @Test
    @DisplayName("Cancel ride by non-owner driver should throw exception")
    void cancelRide_ByNonOwnerDriver_ShouldThrowException() {
        mockAuthenticatedDriver();
        Driver otherDriver = Driver.builder().id(99L).build();
        testRide.setDriver(otherDriver);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.cancelRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("has not accepted it earlier");
    }

    @Test
    @DisplayName("Cancel ride with invalid status should throw exception")
    void cancelRide_WithInvalidStatus_ShouldThrowException() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.ONGOING);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.cancelRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("cannot be cancelled");
    }

    @Test
    @DisplayName("Start ride with valid OTP should start ride and create payment")
    void startRide_WithValidOtp_ShouldStartRideAndCreatePayment() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.CONFIRMED);
        testRide.setStartedAt(null);

        when(rideService.getRideById(1L)).thenReturn(testRide);
        when(rideService.updateRideStatus(testRide, RideStatus.ONGOING)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());

        RideDto result = driverService.startRide(1L, "1234");

        assertThat(result).isNotNull();
        assertThat(testRide.getStartedAt()).isNotNull();
        verify(paymentService).createNewPayment(testRide);
        verify(ratingService).createNewRating(testRide);
    }

    @Test
    @DisplayName("Start ride with invalid OTP should throw exception")
    void startRide_WithInvalidOtp_ShouldThrowException() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.CONFIRMED);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.startRide(1L, "wrong-otp"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Otp is not valid");
    }

    @Test
    @DisplayName("Start ride with invalid status should throw exception")
    void startRide_WithInvalidStatus_ShouldThrowException() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.CANCELLED);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.startRide(1L, "1234"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("status is not CONFIRMED");
    }

    @Test
    @DisplayName("Start ride by non-owner driver should throw exception")
    void startRide_ByNonOwnerDriver_ShouldThrowException() {
        mockAuthenticatedDriver();
        Driver otherDriver = Driver.builder().id(99L).build();
        testRide.setDriver(otherDriver);
        testRide.setRideStatus(RideStatus.CONFIRMED);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.startRide(1L, "1234"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("has not accepted it earlier");
    }

    @Test
    @DisplayName("End ride with ongoing status should end ride and process payment")
    void endRide_WithOngoingStatus_ShouldEndRideAndProcessPayment() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.ONGOING);
        testRide.setStartedAt(LocalDateTime.now());

        when(rideService.getRideById(1L)).thenReturn(testRide);
        when(rideService.updateRideStatus(testRide, RideStatus.ENDED)).thenReturn(testRide);
        when(modelMapper.map(testRide, RideDto.class)).thenReturn(new RideDto());
        when(modelMapper.map(testDriver, DriverDto.class)).thenReturn(new DriverDto());

        RideDto result = driverService.endRide(1L);

        assertThat(result).isNotNull();
        assertThat(testRide.getEndedAt()).isNotNull();
        assertThat(testDriver.getAvailable()).isTrue();
        verify(paymentService).processPayment(testRide);
    }

    @Test
    @DisplayName("End ride with invalid status should throw exception")
    void endRide_WithInvalidStatus_ShouldThrowException() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.CONFIRMED);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.endRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("status is not ONGOING");
    }

    @Test
    @DisplayName("End ride by non-owner driver should throw exception")
    void endRide_ByNonOwnerDriver_ShouldThrowException() {
        mockAuthenticatedDriver();
        Driver otherDriver = Driver.builder().id(99L).build();
        testRide.setDriver(otherDriver);
        testRide.setRideStatus(RideStatus.ONGOING);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.endRide(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("has not accepted it earlier");
    }

    @Test
    @DisplayName("Rate rider for ended ride should return rider dto")
    void rateRider_ForEndedRide_ShouldReturnRiderDto() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.ENDED);

        when(rideService.getRideById(1L)).thenReturn(testRide);
        when(ratingService.rateRider(testRide, 5)).thenReturn(new RiderDto());

        RiderDto result = driverService.rateRider(1L, 5);

        assertThat(result).isNotNull();
        verify(ratingService).rateRider(testRide, 5);
    }

    @Test
    @DisplayName("Rate rider for non-ended ride should throw exception")
    void rateRider_ForNonEndedRide_ShouldThrowException() {
        mockAuthenticatedDriver();
        testRide.setRideStatus(RideStatus.ONGOING);

        when(rideService.getRideById(1L)).thenReturn(testRide);

        assertThatThrownBy(() -> driverService.rateRider(1L, 5))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("status is not Ended");
    }

    @Test
    @DisplayName("Get my profile should return driver dto")
    void getMyProfile_ShouldReturnDriverDto() {
        mockAuthenticatedDriver();
        when(modelMapper.map(testDriver, DriverDto.class)).thenReturn(new DriverDto());

        DriverDto result = driverService.getMyProfile();

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("Get all my rides should return paginated rides")
    void getAllMyRides_ShouldReturnPaginatedRides() {
        mockAuthenticatedDriver();
        Page<Ride> ridePage = new PageImpl<>(List.of(testRide));
        when(rideService.getAllRidesOfDriver(testDriver, PageRequest.of(0, 10))).thenReturn(ridePage);

        Page<RideDto> result = driverService.getAllMyRides(PageRequest.of(0, 10));

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    @DisplayName("Update driver availability should save and return driver")
    void updateDriverAvailability_ShouldSaveAndReturnDriver() {
        when(rideRepository.findByDriverAndRideStatusIn(testDriver, List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)))
                .thenReturn(Collections.emptyList());
        when(driverRepository.updateAvailabilityById(testDriver.getId(), false)).thenReturn(1);
        DriverDto mockDto = new DriverDto();
        mockDto.setAvailable(false);
        when(modelMapper.map(testDriver, DriverDto.class)).thenReturn(mockDto);

        DriverDto result = driverService.updateDriverAvailability(testDriver, false);

        assertThat(result.getAvailable()).isFalse();
        verify(driverRepository).updateAvailabilityById(testDriver.getId(), false);
        verify(driverRepository, never()).save(any(Driver.class));
    }

    @Test
    @DisplayName("Update driver availability should return current driver without save for no-op state changes")
    void updateDriverAvailability_WithNoStateChange_ShouldReturnWithoutSave() {
        testDriver.setAvailable(true);
        DriverDto mockDto = new DriverDto();
        mockDto.setAvailable(true);
        when(modelMapper.map(testDriver, DriverDto.class)).thenReturn(mockDto);

        DriverDto result = driverService.updateDriverAvailability(testDriver, true);

        assertThat(result.getAvailable()).isTrue();
        verify(driverRepository, never()).updateAvailabilityById(anyLong(), anyBoolean());
        verify(driverRepository, never()).save(any(Driver.class));
        verify(rideRepository, never()).findByDriverAndRideStatusIn(any(Driver.class), anyList());
    }

    @Test
    @DisplayName("Update driver availability should reject offline transition when active rides exist")
    void updateDriverAvailability_WithActiveRides_ShouldThrowConflict() {
        testDriver.setAvailable(true);
        Ride activeRide = Ride.builder()
                .id(77L)
                .rideStatus(RideStatus.ONGOING)
                .build();
        when(rideRepository.findByDriverAndRideStatusIn(testDriver, List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)))
                .thenReturn(List.of(activeRide));

        assertThatThrownBy(() -> driverService.updateDriverAvailability(testDriver, false))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("Cannot go offline with active rides");

        verify(driverRepository, never()).updateAvailabilityById(anyLong(), anyBoolean());
        verify(driverRepository, never()).save(any(Driver.class));
    }

    @Test
    @DisplayName("Create new driver should save and return driver")
    void createNewDriver_ShouldSaveAndReturnDriver() {
        when(driverRepository.save(testDriver)).thenReturn(testDriver);

        Driver result = driverService.createNewDriver(testDriver);

        assertThat(result).isEqualTo(testDriver);
    }

    @Test
    @DisplayName("Update driver location should persist coordinates and publish active ride updates")
    void updateDriverLocation_WithActiveRide_ShouldPublishRealtimeUpdate() {
        mockAuthenticatedDriver();
        DriverLocationUpdateRequestDto request = new DriverLocationUpdateRequestDto();
        request.setLat(12.9716);
        request.setLng(77.5946);
        request.setHeading(90.0);
        request.setSpeedKph(24.5);
        request.setAccuracyM(10.0);

        Ride activeRide = Ride.builder()
                .id(55L)
                .driver(testDriver)
                .rideStatus(RideStatus.CONFIRMED)
                .build();
        when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(rideRepository.findTopByDriverAndRideStatusInOrderByCreatedTimeDesc(
                testDriver,
                List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)
        )).thenReturn(Optional.of(activeRide));

        DriverLocationDto response = driverService.updateDriverLocation(request);

        assertThat(response.getLat()).isEqualTo(12.9716);
        assertThat(response.getLng()).isEqualTo(77.5946);
        assertThat(response.getCapturedAt()).isNotNull();

        ArgumentCaptor<DriverLocationUpdateRequestDto> updateCaptor = ArgumentCaptor.forClass(DriverLocationUpdateRequestDto.class);
        verify(rideRealtimeService).publishDriverLocation(eq(activeRide), updateCaptor.capture());
        assertThat(updateCaptor.getValue().getCapturedAt()).isNotNull();
        verify(driverRepository).save(testDriver);
    }

    @Test
    @DisplayName("Update driver location should not publish when there is no active ride")
    void updateDriverLocation_WithoutActiveRide_ShouldNotPublishRealtimeUpdate() {
        mockAuthenticatedDriver();
        DriverLocationUpdateRequestDto request = new DriverLocationUpdateRequestDto();
        request.setLat(12.9610);
        request.setLng(77.6011);
        request.setCapturedAt(LocalDateTime.now());

        when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(rideRepository.findTopByDriverAndRideStatusInOrderByCreatedTimeDesc(
                testDriver,
                List.of(RideStatus.CONFIRMED, RideStatus.ONGOING)
        )).thenReturn(Optional.empty());

        DriverLocationDto response = driverService.updateDriverLocation(request);

        assertThat(response.getLat()).isEqualTo(12.9610);
        assertThat(response.getLng()).isEqualTo(77.6011);
        verify(rideRealtimeService, never()).publishDriverLocation(any(), any());
    }
}
