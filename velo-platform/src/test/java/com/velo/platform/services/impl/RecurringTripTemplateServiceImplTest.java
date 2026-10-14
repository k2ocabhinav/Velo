package com.velo.platform.services.impl;

import com.velo.platform.configs.ScheduledRideConfig;
import com.velo.platform.entities.RecurringTripTemplate;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.Tenant;
import com.velo.platform.repositories.RecurringTripTemplateRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.TenantScopeService;
import com.velo.platform.strategies.RideFareCalculationStrategy;
import com.velo.platform.strategies.RideStrategyManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringTripTemplateServiceImplTest {

    @Mock private RecurringTripTemplateRepository templateRepository;
    @Mock private RideRequestRepository rideRequestRepository;
    @Mock private RiderRepository riderRepository;
    @Mock private RiderService riderService;
    @Mock private RideStrategyManager rideStrategyManager;
    @Mock private TenantRepository tenantRepository;
    @Mock private TenantScopeService tenantScopeService;
    @Mock private ScheduledRideConfig scheduledRideConfig;
    @InjectMocks private RecurringTripTemplateServiceImpl service;

    @Test
    void materializeOccurrences_isIdempotentAcrossSchedulerRetries() {
        LocalDate date = LocalDate.now(java.time.ZoneId.of("UTC")).plusDays(1);
        Rider rider = Rider.builder().id(12L).tenantId(7L).build();
        RecurringTripTemplate template = template(date, rider);
        when(tenantRepository.findAll()).thenReturn(List.of(Tenant.builder().id(7L).build()));
        when(scheduledRideConfig.getRecurringMaterializationHorizonDays()).thenReturn(7);
        when(templateRepository.findByTenantIdAndActiveTrueAndDeletedFalse(7L)).thenReturn(List.of(template));
        when(templateRepository.findByIdAndTenantIdForUpdate(31L, 7L)).thenReturn(java.util.Optional.of(template));
        Set<LocalDate> existingDates = new HashSet<>();
        when(rideRequestRepository.existsByTenantIdAndRecurringTemplate_IdAndOccurrenceDate(7L, 31L, date))
                .thenAnswer(invocation -> existingDates.contains(invocation.getArgument(2)));
        RideFareCalculationStrategy fareStrategy = mock(RideFareCalculationStrategy.class);
        when(rideStrategyManager.rideFareCalculationStrategy()).thenReturn(fareStrategy);
        when(fareStrategy.calculateFare(any(RideRequest.class))).thenReturn(new BigDecimal("28.50"));
        when(rideRequestRepository.save(any(RideRequest.class))).thenAnswer(invocation -> {
            RideRequest request = invocation.getArgument(0);
            existingDates.add(request.getOccurrenceDate());
            return request;
        });

        assertThat(service.materializeOccurrences()).isEqualTo(1);
        assertThat(service.materializeOccurrences()).isZero();
        verify(rideRequestRepository, times(1)).save(any(RideRequest.class));
    }

    @Test
    void getTenantTemplates_scopesRepositoryLookupToCurrentTenant() {
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(44L);
        when(templateRepository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(eq(44L), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.getTenantTemplates(PageRequest.of(0, 10));

        verify(templateRepository).findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(44L, PageRequest.of(0, 10));
        verifyNoInteractions(rideRequestRepository);
    }

    private RecurringTripTemplate template(LocalDate date, Rider rider) {
        GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
        RecurringTripTemplate template = RecurringTripTemplate.builder()
                .id(31L)
                .tenantId(7L)
                .rider(rider)
                .localTime(LocalTime.of(9, 0))
                .startDate(date)
                .endDate(date)
                .pickupLocation(factory.createPoint(new org.locationtech.jts.geom.Coordinate(77.5, 12.9)))
                .dropOffLocation(factory.createPoint(new org.locationtech.jts.geom.Coordinate(77.6, 12.95)))
                .paymentMethod(com.velo.platform.entities.enums.PaymentMethod.CASH)
                .active(true)
                .deleted(false)
                .build();
        template.setDays(Set.of(date.getDayOfWeek()));
        return template;
    }
}
