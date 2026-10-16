package com.velo.platform.services.impl;

import com.velo.platform.configs.ScheduledRideConfig;
import com.velo.platform.dto.PointDto;
import com.velo.platform.dto.RecurringTripTemplateDto;
import com.velo.platform.dto.RecurringTripTemplateRequestDto;
import com.velo.platform.dto.admin.TripSheetRiderOptionDto;
import com.velo.platform.entities.RecurringTripTemplate;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.ScheduledTripReasonCode;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.RecurringTripTemplateRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.RecurringTripTemplateService;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.TenantScopeService;
import com.velo.platform.utils.GeometryUtil;
import com.velo.platform.strategies.RideStrategyManager;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Point;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RecurringTripTemplateServiceImpl implements RecurringTripTemplateService {

    private final RecurringTripTemplateRepository templateRepository;
    private final RideRequestRepository rideRequestRepository;
    private final RiderRepository riderRepository;
    private final RiderService riderService;
    private final RideStrategyManager rideStrategyManager;
    private final TenantRepository tenantRepository;
    private final TenantScopeService tenantScopeService;
    private final ScheduledRideConfig scheduledRideConfig;

    @Override
    @Transactional(readOnly = true)
    public Page<RecurringTripTemplateDto> getTenantTemplates(Pageable pageable) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        return templateRepository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(tenantId, pageable)
                .map(this::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RecurringTripTemplateDto> getMyTemplates(Pageable pageable) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Rider rider = riderService.getCurrentRider();
        return templateRepository.findByTenantIdAndRider_IdAndDeletedFalseOrderByCreatedAtDesc(
                tenantId, rider.getId(), pageable).map(this::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TripSheetRiderOptionDto> getTenantRiders() {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        return riderRepository.findByTenantIdOrderByIdAsc(tenantId).stream()
                .filter(rider -> rider.getUser() != null)
                .map(rider -> TripSheetRiderOptionDto.builder()
                        .riderId(rider.getId())
                        .name(((rider.getUser().getFirstName() == null ? "" : rider.getUser().getFirstName()) + " "
                                + (rider.getUser().getLastName() == null ? "" : rider.getUser().getLastName())).trim())
                        .email(rider.getUser().getEmail())
                        .build())
                .toList();
    }

    @Override
    @Transactional
    public RecurringTripTemplateDto createForTenant(RecurringTripTemplateRequestDto request) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        if (request.getRiderId() == null) throw new RuntimeConflictException("Rider is required");
        Rider rider = riderRepository.findByIdAndTenantId(request.getRiderId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found"));
        return toDto(templateRepository.save(toEntity(request, tenantId, rider)));
    }

    @Override
    @Transactional
    public RecurringTripTemplateDto createForCurrentRider(RecurringTripTemplateRequestDto request) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Rider rider = riderService.getCurrentRider();
        return toDto(templateRepository.save(toEntity(request, tenantId, rider)));
    }

    @Override
    @Transactional
    public RecurringTripTemplateDto updateForTenant(Long id, RecurringTripTemplateRequestDto request) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RecurringTripTemplate template = findTenantTemplate(id, tenantId);
        if (request.getRiderId() == null) throw new RuntimeConflictException("Rider is required");
        Rider rider = riderRepository.findByIdAndTenantId(request.getRiderId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found"));
        applyRequest(template, request, tenantId, rider);
        syncFutureOccurrences(template);
        return toDto(templateRepository.save(template));
    }

    @Override
    @Transactional
    public RecurringTripTemplateDto updateForCurrentRider(Long id, RecurringTripTemplateRequestDto request) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Rider rider = riderService.getCurrentRider();
        RecurringTripTemplate template = templateRepository
                .findByIdAndTenantIdAndRider_Id(id, tenantId, rider.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recurring trip template not found"));
        applyRequest(template, request, tenantId, rider);
        syncFutureOccurrences(template);
        return toDto(templateRepository.save(template));
    }

    @Override
    @Transactional
    public RecurringTripTemplateDto setTenantTemplateActive(Long id, boolean active) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RecurringTripTemplate template = findTenantTemplate(id, tenantId);
        template.setActive(active);
        return toDto(templateRepository.save(template));
    }

    @Override
    @Transactional
    public RecurringTripTemplateDto setMyTemplateActive(Long id, boolean active) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Rider rider = riderService.getCurrentRider();
        RecurringTripTemplate template = templateRepository
                .findByIdAndTenantIdAndRider_Id(id, tenantId, rider.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recurring trip template not found"));
        template.setActive(active);
        return toDto(templateRepository.save(template));
    }

    @Override
    @Transactional
    public void deleteTenantTemplate(Long id) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RecurringTripTemplate template = findTenantTemplate(id, tenantId);
        template.setActive(false);
        template.setDeleted(true);
    }

    @Override
    @Transactional
    public void deleteMyTemplate(Long id) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        Rider rider = riderService.getCurrentRider();
        RecurringTripTemplate template = templateRepository
                .findByIdAndTenantIdAndRider_Id(id, tenantId, rider.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recurring trip template not found"));
        template.setActive(false);
        template.setDeleted(true);
    }

    @Override
    @Transactional
    public int materializeOccurrences() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        int created = 0;

        // Batch jobs have no request tenant. Enumerate tenant IDs, then keep every business query tenant-scoped.
        for (Tenant tenant : tenantRepository.findAll()) {
            ZoneId tenantZone = parseZone(tenant.getTimeZone());
            LocalDate today = LocalDate.now(tenantZone);
            LocalDate through = today.plusDays(Math.max(0, scheduledRideConfig.getRecurringMaterializationHorizonDays()));
            List<Long> templateIds = templateRepository.findByTenantIdAndActiveTrueAndDeletedFalse(tenant.getId())
                    .stream().map(RecurringTripTemplate::getId).toList();
            for (Long templateId : templateIds) {
                RecurringTripTemplate template = templateRepository
                        .findByIdAndTenantIdForUpdate(templateId, tenant.getId()).orElse(null);
                if (template == null || !Boolean.TRUE.equals(template.getActive()) || Boolean.TRUE.equals(template.getDeleted())) {
                    continue;
                }
                LocalDate start = template.getStartDate().isAfter(today) ? template.getStartDate() : today;
                LocalDate end = template.getEndDate().isBefore(through) ? template.getEndDate() : through;
                Set<DayOfWeek> days = template.getDays();
                ZoneId templateZone = parseZone(template.getTimeZone());
                for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
                    LocalDateTime scheduledTime = toUtc(date, template.getLocalTime(), templateZone);
                    if (!days.contains(date.getDayOfWeek()) || !scheduledTime.isAfter(now)) continue;
                    if (rideRequestRepository.existsByTenantIdAndRecurringTemplate_IdAndOccurrenceDate(
                            tenant.getId(), template.getId(), date)) continue;
                    RideRequest occurrence = createOccurrence(template, date, scheduledTime);
                    rideRequestRepository.save(occurrence);
                    created++;
                }
            }
        }
        return created;
    }

    /** A template stores a local time of day; the instant is that wall clock in its zone, kept as UTC. */
    private LocalDateTime toUtc(LocalDate date, LocalTime localTime, ZoneId zone) {
        return LocalDateTime.of(date, localTime).atZone(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private ZoneId parseZone(String zoneId) {
        if (zoneId == null || zoneId.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(zoneId.trim());
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    private String tenantTimeZoneId(Long tenantId) {
        if (tenantId == null) {
            return ZoneOffset.UTC.getId();
        }
        return parseZone(tenantRepository.findById(tenantId).map(Tenant::getTimeZone).orElse(null)).getId();
    }

    private RideRequest createOccurrence(RecurringTripTemplate template, LocalDate date, LocalDateTime scheduledTime) {
        RideRequest request = RideRequest.builder()
                .tenantId(template.getTenantId())
                .rider(template.getRider())
                .pickupLocation(template.getPickupLocation())
                .dropOffLocation(template.getDropOffLocation())
                .pickupAddress(template.getPickupAddress())
                .dropOffAddress(template.getDropOffAddress())
                .externalReference(template.getBookingReference())
                .bookingNotes(template.getNotes())
                .paymentMethod(template.getPaymentMethod())
                .rideRequestStatus(RideRequestStatus.SCHEDULED)
                .scheduledTime(scheduledTime)
                .recurringTemplate(template)
                .occurrenceDate(date)
                .build();
        request.setFare(rideStrategyManager.rideFareCalculationStrategy().calculateFare(request));
        return request;
    }

    private RecurringTripTemplate toEntity(RecurringTripTemplateRequestDto request, Long tenantId, Rider rider) {
        validate(request);
        RecurringTripTemplate template = new RecurringTripTemplate();
        applyRequest(template, request, tenantId, rider);
        template.setActive(true);
        template.setDeleted(false);
        return template;
    }

    private void applyRequest(RecurringTripTemplate template, RecurringTripTemplateRequestDto request,
                              Long tenantId, Rider rider) {
        validate(request);
        template.setTenantId(tenantId);
        template.setRider(rider);
        template.setDays(request.getDaysOfWeek());
        template.setLocalTime(request.getLocalTime());
        template.setTimeZone(tenantTimeZoneId(tenantId));
        template.setStartDate(request.getStartDate());
        template.setEndDate(request.getEndDate());
        template.setPickupLocation(GeometryUtil.createPoint(request.getPickupLocation()));
        template.setDropOffLocation(GeometryUtil.createPoint(request.getDropOffLocation()));
        template.setPickupAddress(clean(request.getPickupAddress()));
        template.setDropOffAddress(clean(request.getDropOffAddress()));
        template.setPaymentMethod(request.getPaymentMethod());
        template.setNotes(clean(request.getNotes()));
        template.setBookingReference(clean(request.getBookingReference()));
    }

    private void syncFutureOccurrences(RecurringTripTemplate template) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<RideRequest> rows = rideRequestRepository
                .findByTenantIdAndRecurringTemplate_IdAndRideRequestStatusAndScheduledTimeAfter(
                        template.getTenantId(), template.getId(), RideRequestStatus.SCHEDULED, now);
        Set<DayOfWeek> days = template.getDays();
        ZoneId templateZone = parseZone(template.getTimeZone());
        for (RideRequest row : rows) {
            LocalDate date = row.getOccurrenceDate() != null ? row.getOccurrenceDate() : row.getScheduledTime().toLocalDate();
            LocalDateTime updatedTime = toUtc(date, template.getLocalTime(), templateZone);
            if (date.isBefore(template.getStartDate()) || date.isAfter(template.getEndDate())
                    || !days.contains(date.getDayOfWeek()) || !updatedTime.isAfter(now)) {
                row.setRideRequestStatus(RideRequestStatus.CANCELLED);
                row.setReasonCode(ScheduledTripReasonCode.OPERATOR_CANCELLED);
                row.setReasonNote("Recurring trip template was updated");
                continue;
            }
            row.setRider(template.getRider());
            row.setScheduledTime(updatedTime);
            row.setPickupLocation(template.getPickupLocation());
            row.setDropOffLocation(template.getDropOffLocation());
            row.setPickupAddress(template.getPickupAddress());
            row.setDropOffAddress(template.getDropOffAddress());
            row.setExternalReference(template.getBookingReference());
            row.setBookingNotes(template.getNotes());
            row.setPaymentMethod(template.getPaymentMethod());
            row.setReasonCode(null);
            row.setReasonNote(null);
            row.setFare(rideStrategyManager.rideFareCalculationStrategy().calculateFare(row));
        }
    }

    private RecurringTripTemplate findTenantTemplate(Long id, Long tenantId) {
        return templateRepository.findByIdAndTenantId(id, tenantId)
                .filter(template -> !Boolean.TRUE.equals(template.getDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Recurring trip template not found"));
    }

    private void validate(RecurringTripTemplateRequestDto request) {
        if (request.getDaysOfWeek() == null || request.getDaysOfWeek().isEmpty()) {
            throw new RuntimeConflictException("Choose at least one day of the week");
        }
        if (request.getStartDate() != null && request.getEndDate() != null
                && request.getEndDate().isBefore(request.getStartDate())) {
            throw new RuntimeConflictException("End date must be on or after start date");
        }
        validatePoint(request.getPickupLocation(), "Pickup");
        validatePoint(request.getDropOffLocation(), "Drop-off");
    }

    private void validatePoint(PointDto point, String label) {
        if (point == null || point.getCoordinates() == null || point.getCoordinates().length != 2) {
            throw new RuntimeConflictException(label + " coordinates must include longitude and latitude");
        }
        double longitude = point.getCoordinates()[0];
        double latitude = point.getCoordinates()[1];
        if (!Double.isFinite(longitude) || !Double.isFinite(latitude)
                || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
            throw new RuntimeConflictException(label + " coordinates are invalid");
        }
    }

    private RecurringTripTemplateDto toDto(RecurringTripTemplate template) {
        Rider rider = template.getRider();
        String riderName = rider == null || rider.getUser() == null ? "" :
                ((rider.getUser().getFirstName() == null ? "" : rider.getUser().getFirstName()) + " "
                        + (rider.getUser().getLastName() == null ? "" : rider.getUser().getLastName())).trim();
        return RecurringTripTemplateDto.builder()
                .id(template.getId())
                .riderId(rider == null ? null : rider.getId())
                .riderName(riderName)
                .daysOfWeek(template.getDays())
                .localTime(template.getLocalTime())
                .startDate(template.getStartDate())
                .endDate(template.getEndDate())
                .pickupLocation(toPointDto(template.getPickupLocation()))
                .dropOffLocation(toPointDto(template.getDropOffLocation()))
                .pickupAddress(template.getPickupAddress())
                .dropOffAddress(template.getDropOffAddress())
                .paymentMethod(template.getPaymentMethod())
                .notes(template.getNotes())
                .bookingReference(template.getBookingReference())
                .active(Boolean.TRUE.equals(template.getActive()))
                .build();
    }

    private PointDto toPointDto(Point point) {
        return point == null ? null : new PointDto(new double[]{point.getX(), point.getY()});
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
