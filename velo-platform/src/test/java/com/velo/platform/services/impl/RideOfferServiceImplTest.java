package com.velo.platform.services.impl;

import com.velo.platform.utils.UtcTimes;
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
import jakarta.persistence.EntityManager;
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

    @Mock
    private EntityManager entityManager;

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
                dispatchProperties,
                entityManager
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
            assertThat(offer.getExpiresAt()).isAfter(UtcTimes.now().plusSeconds(40));
        });
    }

    @Test
    @DisplayName("createOffers uses the configured offer TTL")
    void createOffers_UsesConfiguredTtl() {
        RideRequest request = RideRequest.builder().id(100L).build();
        dispatchProperties.setOfferTtlSeconds(90L);
        when(rideOfferRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<RideOffer> offers = rideOfferService.createOffers(request, List.of(Driver.builder().id(1L).build()));

        assertThat(offers.get(0).getExpiresAt()).isAfter(UtcTimes.now().plusSeconds(85));
    }

    @Test
    @DisplayName("findAcceptableOffer returns empty and marks stale offers expired")
    void findAcceptableOffer_ShouldExpireStaleOffer() {
        RideOffer stale = RideOffer.builder()
                .id(42L)
                .status(RideOfferStatus.OFFERED)
                .expiresAt(UtcTimes.now().minusSeconds(1))
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
                .expiresAt(UtcTimes.now().minusSeconds(2))
                .build();

        when(rideOfferRepository.findByStatusAndExpiresAtLessThanEqual(eq(RideOfferStatus.OFFERED), any(LocalDateTime.class)))
                .thenReturn(List.of(stale));
        when(rideOfferRepository.expireIfStillOffered(
                eq(501L), eq(RideOfferStatus.OFFERED), eq(RideOfferStatus.EXPIRED),
                any(LocalDateTime.class), eq("Offer timed out."))).thenReturn(1);
        when(rideRequestRepository.expirePendingIfNoOpenOffers(
                301L, RideRequestStatus.PENDING, RideRequestStatus.EXPIRED,
                RideOfferStatus.OFFERED, RideOfferStatus.ACCEPTED)).thenReturn(1);
        doAnswer(invocation -> {
            rideRequest.setRideRequestStatus(RideRequestStatus.EXPIRED);
            return null;
        }).when(entityManager).refresh(rideRequest);

        int expired = rideOfferService.expireStaleOffers();

        assertThat(expired).isEqualTo(1);
        assertThat(rideRequest.getRideRequestStatus()).isEqualTo(RideRequestStatus.EXPIRED);
        verify(rideRealtimeService).publishRideRequestPending(rideRequest);
        verify(notificationService, atLeast(1)).createNotification(any(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("expireStaleOffers skips offers accepted while the sweep is running")
    void expireStaleOffers_SkipsConcurrentlyAcceptedOffer() {
        RideOffer stale = RideOffer.builder()
                .id(502L)
                .status(RideOfferStatus.OFFERED)
                .expiresAt(UtcTimes.now().minusSeconds(1))
                .build();
        when(rideOfferRepository.findByStatusAndExpiresAtLessThanEqual(eq(RideOfferStatus.OFFERED), any(LocalDateTime.class)))
                .thenReturn(List.of(stale));
        when(rideOfferRepository.expireIfStillOffered(
                eq(502L), eq(RideOfferStatus.OFFERED), eq(RideOfferStatus.EXPIRED),
                any(LocalDateTime.class), eq("Offer timed out."))).thenReturn(0);

        int expired = rideOfferService.expireStaleOffers();

        assertThat(expired).isZero();
        verify(rideRequestRepository, never()).expirePendingIfNoOpenOffers(
                any(), any(), any(), any(), any());
        verifyNoInteractions(notificationService, rideRealtimeService, entityManager);
    }
}
