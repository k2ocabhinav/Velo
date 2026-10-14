package com.velo.platform.services.impl;

import com.velo.platform.configs.ScheduledRideConfig;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.ScheduledTripReasonCode;
import com.velo.platform.repositories.NotificationRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.TenantScopeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripSheetServiceImplTest {

    @Mock private RideRequestRepository rideRequestRepository;
    @Mock private TenantScopeService tenantScopeService;
    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationService notificationService;
    @Mock private UserRepository userRepository;
    @Mock private TenantRepository tenantRepository;
    @Mock private ScheduledRideConfig scheduledRideConfig;
    @InjectMocks private TripSheetServiceImpl service;

    @Test
    void needsAttentionTrips_onlyIncludesTenantRowsInsideConfiguredWindow() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("UTC"));
        RideRequest soon = RideRequest.builder().id(22L).tenantId(5L).scheduledTime(now.plusMinutes(30))
                .rideRequestStatus(RideRequestStatus.SCHEDULED).build();
        RideRequest later = RideRequest.builder().id(23L).tenantId(5L).scheduledTime(now.plusMinutes(90))
                .rideRequestStatus(RideRequestStatus.SCHEDULED).build();
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(5L);
        when(scheduledRideConfig.getUnassignedAlertWindowMinutes()).thenReturn(60);
        when(rideRequestRepository.findByTenantIdAndRideRequestStatusInAndScheduledTimeBetweenOrderByScheduledTimeAsc(
                eq(5L), anyList(), any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(List.of(soon, later));

        var rows = service.getNeedsAttentionTrips();

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getRideRequestId()).isEqualTo(22L);
        assertThat(rows.getFirst().isNeedsAttention()).isTrue();
        verify(rideRequestRepository).findByTenantIdAndRideRequestStatusInAndScheduledTimeBetweenOrderByScheduledTimeAsc(
                eq(5L), anyList(), any(LocalDateTime.class), any(LocalDateTime.class));
    }

    @Test
    void csvIncludesTripFieldsAndEscapesQuotedReasonNotes() {
        LocalDate date = LocalDate.of(2026, 10, 16);
        Rider rider = Rider.builder().user(User.builder().firstName("Asha").lastName("Patel").build()).build();
        RideRequest request = RideRequest.builder()
                .id(3L)
                .tenantId(5L)
                .rider(rider)
                .scheduledTime(date.atTime(9, 15))
                .externalReference("HOTEL, 42")
                .pickupAddress("Central Hotel")
                .dropOffAddress("Airport")
                .rideRequestStatus(RideRequestStatus.CANCELLED)
                .reasonCode(ScheduledTripReasonCode.OTHER)
                .reasonNote("Guest said \"not today\"")
                .build();
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(5L);
        when(scheduledRideConfig.getUnassignedAlertWindowMinutes()).thenReturn(60);
        when(rideRequestRepository.findByTenantIdAndScheduledTimeGreaterThanEqualAndScheduledTimeLessThanOrderByScheduledTimeAsc(
                5L, date.atStartOfDay(), date.plusDays(1).atStartOfDay())).thenReturn(List.of(request));

        String csv = new String(service.exportCsv(date), java.nio.charset.StandardCharsets.UTF_8);

        assertThat(csv).contains("date,time,booking reference,rider,pickup,drop-off,driver,status,reason code,reason note");
        assertThat(csv).contains("\"2026-10-16\",\"09:15\",\"HOTEL, 42\",\"Asha Patel\",\"Central Hotel\",\"Airport\",\"\",\"CANCELLED\",\"OTHER\",\"Guest said \"\"not today\"\"\"");
    }
}
