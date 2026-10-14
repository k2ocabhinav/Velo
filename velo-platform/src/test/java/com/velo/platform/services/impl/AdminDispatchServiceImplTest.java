package com.velo.platform.services.impl;

import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.enums.RideOfferStatus;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.repositories.RideOfferRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.services.TenantScopeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDispatchServiceImplTest {

    @Mock private RideRequestRepository rideRequestRepository;
    @Mock private RideOfferRepository rideOfferRepository;
    @Mock private TenantScopeService tenantScopeService;
    @InjectMocks private AdminDispatchServiceImpl adminDispatchService;

    @BeforeEach
    void setUp() {
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(1L);
    }

    @Test
    void getPendingRideRequests_countsOffersForThePageInOneAggregateQuery() {
        var pageable = PageRequest.of(0, 10);
        RideRequest firstRequest = RideRequest.builder()
                .id(11L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .build();
        RideRequest secondRequest = RideRequest.builder()
                .id(12L)
                .rideRequestStatus(RideRequestStatus.PENDING)
                .build();
        Page<RideRequest> requests = new PageImpl<>(List.of(firstRequest, secondRequest), pageable, 2);
        when(rideRequestRepository.findByTenantIdAndRideRequestStatusOrderByRequestedTimeDesc(
                1L, RideRequestStatus.PENDING, pageable)).thenReturn(requests);

        RideOfferRepository.OfferCountProjection firstCount = mock(RideOfferRepository.OfferCountProjection.class);
        when(firstCount.getRideRequestId()).thenReturn(11L);
        when(firstCount.getOfferCount()).thenReturn(2L);
        RideOfferRepository.OfferCountProjection secondCount = mock(RideOfferRepository.OfferCountProjection.class);
        when(secondCount.getRideRequestId()).thenReturn(12L);
        when(secondCount.getOfferCount()).thenReturn(0L);
        when(rideOfferRepository.countOffersByRideRequestIdsAndStatus(
                List.of(11L, 12L), RideOfferStatus.OFFERED)).thenReturn(List.of(firstCount, secondCount));

        var result = adminDispatchService.getPendingRideRequests(pageable);

        assertThat(result.getContent())
                .extracting("offeredDriverCount")
                .containsExactly(2L, 0L);
        verify(rideOfferRepository).countOffersByRideRequestIdsAndStatus(
                List.of(11L, 12L), RideOfferStatus.OFFERED);
        verify(rideOfferRepository, never()).countByRideRequestIdAndStatus(anyLong(), any());
    }
}
