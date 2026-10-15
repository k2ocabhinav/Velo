package com.velo.platform.services.impl;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.RideOfferStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.configs.DispatchProperties;
import com.velo.platform.repositories.RideOfferRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.RideRealtimeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RideOfferServiceImplTest {

    @Mock
    private RideOfferRepository rideOfferRepository;

    @Mock
    private RideRequestRepository rideRequestRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private RideRealtimeService rideRealtimeService;

    private DispatchProperties dispatchProperties;
    private RideOfferServiceImpl rideOfferService;

    @BeforeEach
    void setUp() {
        dispatchProperties = new DispatchProperties();
        rideOfferService = new RideOfferServiceImpl(
                rideOfferRepository,
                rideRequestRepository,
                notificationService,
                rideRealtimeService,
                dispatchProperties
        );
    }

    @Test
    @DisplayName("createOffers persists OFFERED rows for each matched driver")
    void createOffers_ShouldPersistOffers() {
        RideRequest request = RideRequest.builder().id(99L).build();
        Driver d1 = Driver.builder().id(1L).build();
        Driver d2 = Driver.builder().id(2L).build();

        when(rideOfferRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<RideOffer> offers = rideOfferService.createOffers(request, List.of(d1, d2));

        assertThat(offers).hasSize(2);
        assertThat(offers).allSatisfy((offer) -> {
            assertThat(offer.getStatus()).isEqualTo(RideOfferStatus.OFFERED);
            assertThat(offer.getRideRequest()).isEqualTo(request);
            assertThat(offer.getExpiresAt()).isAfter(LocalDateTime.now().plusSeconds(40));
        });
    }

    @Test
    @DisplayName("createOffers uses the configured offer TTL")
    void createOffers_UsesConfiguredTtl() {
        RideRequest request = RideRequest.builder().id(100L).build();
        dispatchProperties.setOfferTtlSeconds(90L);
        when(rideOfferRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<RideOffer> offers = rideOfferService.createOffers(request, List.of(Driver.builder().id(1L).build()));

        assertThat(offers.get(0).getExpiresAt()).isAfter(LocalDateTime.now().plusSeconds(85));
    }

    @Test
    @DisplayName("findAcceptableOffer returns empty and marks stale offers expired")
    void findAcceptableOffer_ShouldExpireStaleOffer() {
        RideOffer stale = RideOffer.builder()
                .id(42L)
                .status(RideOfferStatus.OFFERED)
                .expiresAt(LocalDateTime.now().minusSeconds(1))
                .build();

        when(rideOfferRepository.findTopByRideRequestIdAndDriverIdAndStatusOrderByOfferedAtDesc(
                100L, 7L, RideOfferStatus.OFFERED
        )).thenReturn(Optional.of(stale));

        Optional<RideOffer> result = rideOfferService.findAcceptableOffer(100L, 7L);

        assertThat(result).isEmpty();
        verify(rideOfferRepository).save(stale);
        assertThat(stale.getStatus()).isEqualTo(RideOfferStatus.EXPIRED);
    }

    @Test
    @DisplayName("expireStaleOffers transitions pending ride requests to EXPIRED when no open offers remain")
    void expireStaleOffers_ShouldExpirePendingRideRequest() {
        User riderUser = User.builder().id(11L).build();
        Rider rider = Rider.builder().id(21L).user(riderUser).build();
        RideRequest rideRequest = RideRequest.builder()
                .id(301L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .rider(rider)
                .build();

        Driver driver = Driver.builder().id(9L).user(User.builder().id(19L).build()).build();
        RideOffer stale = RideOffer.builder()
                .id(501L)
                .rideRequest(rideRequest)
                .driver(driver)
                .status(RideOfferStatus.OFFERED)
                .expiresAt(LocalDateTime.now().minusSeconds(2))
                .build();

        when(rideOfferRepository.findByStatusAndExpiresAtLessThanEqual(eq(RideOfferStatus.OFFERED), any(LocalDateTime.class)))
                .thenReturn(List.of(stale));
        when(rideOfferRepository.existsByRideRequestIdAndStatus(301L, RideOfferStatus.OFFERED)).thenReturn(false);
        when(rideOfferRepository.existsByRideRequestIdAndStatus(301L, RideOfferStatus.ACCEPTED)).thenReturn(false);
        when(rideRequestRepository.save(rideRequest)).thenReturn(rideRequest);

        int expired = rideOfferService.expireStaleOffers();

        assertThat(expired).isEqualTo(1);
        assertThat(rideRequest.getRideRequestStatus()).isEqualTo(RideRequestStatus.EXPIRED);
        verify(rideRealtimeService).publishRideRequestPending(rideRequest);
        verify(notificationService, atLeast(1)).createNotification(any(), anyString(), anyString(), any(), any());
    }
}
