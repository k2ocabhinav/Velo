package com.velo.platform.services.impl;

import com.velo.platform.dto.admin.TripSheetReasonRequestDto;
import com.velo.platform.dto.admin.TripSheetRowDto;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.NotificationType;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.entities.enums.RideRequestStatus;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.entities.enums.ScheduledTripReasonCode;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.NotificationRepository;
import com.velo.platform.repositories.RideRequestRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.services.NotificationService;
import com.velo.platform.services.TenantScopeService;
import com.velo.platform.services.TripSheetService;
import com.velo.platform.configs.ScheduledRideConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TripSheetServiceImpl implements TripSheetService {

    private static final ZoneId ZONE = ZoneId.of("UTC");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    private static final List<RideRequestStatus> ALERTABLE_STATUSES = List.of(
            RideRequestStatus.SCHEDULED, RideRequestStatus.PENDING);

    private final RideRequestRepository rideRequestRepository;
    private final TenantScopeService tenantScopeService;
    private final ScheduledRideConfig scheduledRideConfig;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;

    @Override
    @Transactional(readOnly = true)
    public List<TripSheetRowDto> getTripSheet(LocalDate date, String assignmentFilter) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        List<TripSheetRowDto> rows = listForDate(tenantId, date);
        if (assignmentFilter == null || assignmentFilter.isBlank() || "ALL".equalsIgnoreCase(assignmentFilter)) return rows;
        boolean assigned = "ASSIGNED".equalsIgnoreCase(assignmentFilter);
        if (!assigned && !"UNASSIGNED".equalsIgnoreCase(assignmentFilter)) {
            throw new RuntimeConflictException("Assignment filter must be ALL, ASSIGNED, or UNASSIGNED");
        }
        return rows.stream().filter(row -> row.isAssigned() == assigned).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TripSheetRowDto> getNeedsAttentionTrips() {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        LocalDateTime now = LocalDateTime.now(ZONE);
        LocalDateTime until = now.plusMinutes(Math.max(0, scheduledRideConfig.getUnassignedAlertWindowMinutes()));
        return toRows(rideRequestRepository.findByTenantIdAndRideRequestStatusInAndScheduledTimeBetweenOrderByScheduledTimeAsc(
                        tenantId, ALERTABLE_STATUSES, now, until), now, until)
                .stream().filter(row -> row.isNeedsAttention() && !row.isAssigned()).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public int getNeedsAttentionCount() {
        return getNeedsAttentionTrips().size();
    }

    @Override
    @Transactional
    public int createUnassignedTripAlerts() {
        LocalDateTime now = LocalDateTime.now(ZONE);
        LocalDateTime until = now.plusMinutes(Math.max(0, scheduledRideConfig.getUnassignedAlertWindowMinutes()));
        int created = 0;
        for (Tenant tenant : tenantRepository.findAll()) {
            List<RideRequest> rows = rideRequestRepository
                    .findByTenantIdAndRideRequestStatusInAndScheduledTimeBetweenOrderByScheduledTimeAsc(
                            tenant.getId(), ALERTABLE_STATUSES, now, until);
            List<User> admins = userRepository.findTenantUsersByRole(tenant.getId(), Role.ADMIN);
            for (RideRequest row : rows) {
                if (row.getRide() != null && row.getRide().getDriver() != null) continue;
                for (User admin : admins) {
                    if (notificationRepository.existsByTenantIdAndUserAndTypeAndReferenceId(
                            tenant.getId(), admin, NotificationType.SCHEDULED_TRIP_UNASSIGNED, row.getId())) continue;
                    notificationService.createNotification(
                            admin,
                            "Scheduled trip needs a driver",
                            "A scheduled trip starting soon is still unassigned.",
                            NotificationType.SCHEDULED_TRIP_UNASSIGNED,
                            row.getId());
                    created++;
                }
            }
        }
        return created;
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportCsv(LocalDate date) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        StringBuilder csv = new StringBuilder("date,time,booking reference,rider,pickup,drop-off,driver,status,reason code,reason note\r\n");
        for (TripSheetRowDto row : listForDate(tenantId, date)) {
            LocalDateTime time = row.getScheduledTime();
            appendCsvRow(csv, List.of(
                    DATE_FORMAT.format(time.toLocalDate()),
                    TIME_FORMAT.format(time.toLocalTime()),
                    value(row.getBookingReference()),
                    value(row.getRiderName()),
                    value(row.getPickupAddress()),
                    value(row.getDropOffAddress()),
                    value(row.getDriverName()),
                    row.getStatus() == null ? "" : row.getStatus().name(),
                    row.getReasonCode() == null ? "" : row.getReasonCode().name(),
                    value(row.getReasonNote())
            ));
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    @Transactional
    public TripSheetRowDto cancel(Long rideRequestId, TripSheetReasonRequestDto request) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RideRequest ride = rideRequestRepository.findByIdAndTenantIdForUpdate(rideRequestId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheduled trip not found"));
        if (ride.getRideRequestStatus() != RideRequestStatus.SCHEDULED
                && ride.getRideRequestStatus() != RideRequestStatus.PENDING) {
            throw new RuntimeConflictException("Only unassigned scheduled trips can be cancelled from the trip sheet");
        }
        ride.setRideRequestStatus(RideRequestStatus.CANCELLED);
        ride.setReasonCode(request == null || request.getReasonCode() == null
                ? ScheduledTripReasonCode.OPERATOR_CANCELLED : request.getReasonCode());
        ride.setReasonNote(request == null ? null : clean(request.getNote()));
        return toRow(ride, LocalDateTime.now(ZONE), LocalDateTime.now(ZONE));
    }

    @Override
    @Transactional
    public TripSheetRowDto markNoShow(Long rideRequestId, TripSheetReasonRequestDto request) {
        Long tenantId = tenantScopeService.requireCurrentTenantId();
        RideRequest ride = rideRequestRepository.findByIdAndTenantIdForUpdate(rideRequestId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheduled trip not found"));
        if (ride.getRideRequestStatus() != RideRequestStatus.CONFIRMED) {
            throw new RuntimeConflictException("A trip must be assigned before it can be marked as a no-show");
        }
        if (ride.getScheduledTime() != null && ride.getScheduledTime().isAfter(LocalDateTime.now(ZONE))) {
            throw new RuntimeConflictException("A future trip cannot be marked as a no-show");
        }
        ScheduledTripReasonCode code = request == null || request.getReasonCode() == null
                ? ScheduledTripReasonCode.CUSTOMER_NO_SHOW : request.getReasonCode();
        if (code != ScheduledTripReasonCode.CUSTOMER_NO_SHOW && code != ScheduledTripReasonCode.OTHER) {
            throw new RuntimeConflictException("No-show reason must be Customer no-show or Other");
        }
        ride.setRideRequestStatus(RideRequestStatus.NO_SHOW);
        ride.setReasonCode(code);
        ride.setReasonNote(request == null ? null : clean(request.getNote()));
        return toRow(ride, LocalDateTime.now(ZONE), LocalDateTime.now(ZONE));
    }

    private List<TripSheetRowDto> listForDate(Long tenantId, LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.plusDays(1).atStartOfDay();
        LocalDateTime now = LocalDateTime.now(ZONE);
        LocalDateTime attentionEnd = now.plusMinutes(Math.max(0, scheduledRideConfig.getUnassignedAlertWindowMinutes()));
        return toRows(rideRequestRepository
                .findByTenantIdAndScheduledTimeGreaterThanEqualAndScheduledTimeLessThanOrderByScheduledTimeAsc(
                        tenantId, start, end), now, attentionEnd);
    }

    private List<TripSheetRowDto> toRows(List<RideRequest> requests, LocalDateTime now, LocalDateTime attentionEnd) {
        return requests.stream().map(request -> toRow(request, now, attentionEnd)).toList();
    }

    private TripSheetRowDto toRow(RideRequest request, LocalDateTime now, LocalDateTime attentionEnd) {
        String riderName = request.getRider() == null || request.getRider().getUser() == null ?
                request.getCustomerName() : fullName(request.getRider().getUser().getFirstName(), request.getRider().getUser().getLastName());
        boolean assigned = request.getRide() != null && request.getRide().getDriver() != null;
        boolean alertable = request.getRideRequestStatus() == RideRequestStatus.SCHEDULED
                || request.getRideRequestStatus() == RideRequestStatus.PENDING;
        LocalDateTime scheduled = request.getScheduledTime();
        boolean needsAttention = !assigned && alertable && scheduled != null
                && !scheduled.isBefore(now) && !scheduled.isAfter(attentionEnd);
        return TripSheetRowDto.builder()
                .rideRequestId(request.getId())
                .recurringTemplateId(request.getRecurringTemplate() == null ? null : request.getRecurringTemplate().getId())
                .scheduledTime(scheduled)
                .bookingReference(request.getExternalReference())
                .riderName(riderName)
                .pickupAddress(request.getPickupAddress())
                .dropOffAddress(request.getDropOffAddress())
                .driverName(assigned ? fullName(request.getRide().getDriver().getUser().getFirstName(),
                        request.getRide().getDriver().getUser().getLastName()) : null)
                .assigned(assigned)
                .needsAttention(needsAttention)
                .status(request.getRideRequestStatus())
                .reasonCode(request.getReasonCode())
                .reasonNote(request.getReasonNote())
                .build();
    }

    private String fullName(String first, String last) {
        return ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String value(String value) {
        return value == null ? "" : value;
    }

    private void appendCsvRow(StringBuilder output, List<String> cells) {
        List<String> escaped = new ArrayList<>(cells.size());
        for (String cell : cells) escaped.add("\"" + cell.replace("\"", "\"\"") + "\"");
        output.append(String.join(",", escaped)).append("\r\n");
    }
}
