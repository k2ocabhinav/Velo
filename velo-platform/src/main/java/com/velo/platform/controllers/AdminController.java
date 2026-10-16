package com.velo.platform.controllers;

import com.velo.platform.dto.admin.AdminStatsDto;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.dto.admin.AdminUserDto;
import com.velo.platform.dto.admin.AdminDispatchActionRequestDto;
import com.velo.platform.dto.admin.AdminDispatchAuditDto;
import com.velo.platform.dto.admin.AdminCreateDispatchRequestDto;
import com.velo.platform.dto.admin.AdminOpsHealthDto;
import com.velo.platform.dto.admin.AdminPendingRideRequestDto;
import com.velo.platform.dto.admin.AdminActiveRideDto;
import com.velo.platform.dto.admin.AdminReasonRequestDto;
import com.velo.platform.dto.admin.AdminRideOfferDto;
import com.velo.platform.dto.admin.AdminLiveDispatchDto;
import com.velo.platform.dto.admin.DashboardDto;
import com.velo.platform.dto.admin.PendingDriverDto;
import com.velo.platform.dto.admin.RevenueReportDto;
import com.velo.platform.dto.admin.TopDriverRevenueDto;
import com.velo.platform.dto.admin.TripSheetReasonRequestDto;
import com.velo.platform.dto.admin.TripSheetRowDto;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.services.AdminDispatchService;
import com.velo.platform.services.AdminService;
import com.velo.platform.services.TripSheetService;
import com.velo.platform.services.PayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ContentDisposition;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin", description = "Admin management and analytics")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminController {

    private final AdminService adminService;
    private final AdminDispatchService adminDispatchService;
    private final PayoutService payoutService;
    private final com.velo.platform.services.ScheduledRideService scheduledRideService;
    private final TripSheetService tripSheetService;

    @GetMapping("/stats/dashboard")
    @Operation(summary = "Get dashboard overview")
    public ResponseEntity<DashboardDto> getDashboard() {
        return ResponseEntity.ok(adminService.getDashboard());
    }

    @GetMapping("/stats/daily")
    @Operation(summary = "Get daily statistics")
    public ResponseEntity<AdminStatsDto> getDailyStats(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(adminService.getDailyStats(date));
    }

    @GetMapping("/stats/revenue")
    @Operation(summary = "Get revenue report")
    public ResponseEntity<List<RevenueReportDto>> getRevenueReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(adminService.getRevenueReport(startDate, endDate));
    }

    @GetMapping("/stats/revenue/top-drivers")
    @Operation(summary = "Get the top drivers by net earnings for the last 30 days or selected period")
    public ResponseEntity<List<TopDriverRevenueDto>> getTopDriversByRevenue(
            @RequestParam(defaultValue = "30") @Min(1) @Max(90) int days) {
        return ResponseEntity.ok(adminService.getTopDriversByRevenue(days));
    }

    @GetMapping("/drivers/pending")
    @Operation(summary = "Get pending driver approvals")
    public ResponseEntity<Page<PendingDriverDto>> getPendingDrivers(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(adminService.getPendingDrivers(pageRequest));
    }

    @GetMapping("/drivers")
    @Operation(summary = "Get drivers by onboarding status")
    public ResponseEntity<Page<PendingDriverDto>> getDriversByStatus(
            @RequestParam(defaultValue = "PENDING") DriverOnboardingStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size
    ) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(adminService.getDriversByStatus(status, pageRequest));
    }

    @PostMapping("/drivers/{id}/approve")
    @Operation(summary = "Approve a driver")
    public ResponseEntity<Void> approveDriver(@PathVariable Long id) {
        adminService.approveDriver(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/drivers/{id}/suspend")
    @Operation(summary = "Suspend an approved driver")
    public ResponseEntity<Void> suspendDriver(@PathVariable Long id) {
        adminService.suspendDriver(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/drivers/{id}/reject")
    @Operation(summary = "Reject a driver")
    public ResponseEntity<Void> rejectDriver(@PathVariable Long id, @RequestBody String reason) {
        adminService.rejectDriver(id, reason);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/drivers/{id}/revoke")
    @Operation(summary = "Revoke an approved driver (alias of suspend)")
    public ResponseEntity<Void> revokeDriver(@PathVariable Long id) {
        adminService.suspendDriver(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/users")
    @Operation(summary = "Get all users")
    public ResponseEntity<Page<AdminUserDto>> getAllUsers(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdTime"));
        return ResponseEntity.ok(adminService.getAllUsers(pageRequest));
    }

    @PostMapping("/users/{id}/deactivate")
    @Operation(summary = "Deactivate a user")
    public ResponseEntity<Void> deactivateUser(@PathVariable Long id) {
        adminService.deactivateUser(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{id}/activate")
    @Operation(summary = "Activate a user")
    public ResponseEntity<Void> activateUser(@PathVariable Long id) {
        adminService.activateUser(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/payouts/pending")
    @Operation(summary = "Get pending driver payouts")
    public ResponseEntity<Page<com.velo.platform.dto.PayoutRequestDto>> getPendingPayouts(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "requestedAt"));
        return ResponseEntity.ok(payoutService.getPendingPayouts(pageRequest));
    }

    @GetMapping("/payouts")
    @Operation(summary = "Get driver payouts, optionally filtered by status")
    public ResponseEntity<Page<com.velo.platform.dto.PayoutRequestDto>> getPayouts(
            @RequestParam(required = false) com.velo.platform.entities.enums.PayoutStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "requestedAt"));
        return ResponseEntity.ok(payoutService.getPayouts(status, pageRequest));
    }

    @PostMapping("/payouts/{id}/approve")
    @Operation(summary = "Approve a payout request")
    public ResponseEntity<com.velo.platform.dto.PayoutRequestDto> approvePayout(
            @PathVariable Long id, @RequestBody(required = false) String adminNote) {
        return ResponseEntity.ok(payoutService.approvePayout(id, adminNote));
    }

    @PostMapping("/payouts/{id}/reject")
    @Operation(summary = "Reject a payout request")
    public ResponseEntity<com.velo.platform.dto.PayoutRequestDto> rejectPayout(
            @PathVariable Long id, @RequestBody String adminNote) {
        return ResponseEntity.ok(payoutService.rejectPayout(id, adminNote));
    }

    @PostMapping("/payouts/{id}/process")
    @Operation(summary = "Process an approved payout request")
    public ResponseEntity<com.velo.platform.dto.PayoutRequestDto> processPayout(@PathVariable Long id) {
        return ResponseEntity.ok(payoutService.processPayout(id));
    }

    @GetMapping("/scheduled-rides")
    @Operation(summary = "Get all platform-wide scheduled rides")
    public ResponseEntity<Page<com.velo.platform.dto.ScheduledRideDto>> getAllScheduledRides(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(scheduledRideService.getAllScheduledRides(pageRequest));
    }

    @GetMapping("/trip-sheet")
    @Operation(summary = "Get scheduled trips for a selected date")
    public ResponseEntity<List<TripSheetRowDto>> getTripSheet(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "ALL") String assignment) {
        return ResponseEntity.ok(tripSheetService.getTripSheet(date, assignment));
    }

    @GetMapping("/trip-sheet/attention")
    @Operation(summary = "Get scheduled trips starting soon without a driver")
    public ResponseEntity<List<TripSheetRowDto>> getTripsNeedingAttention() {
        return ResponseEntity.ok(tripSheetService.getNeedsAttentionTrips());
    }

    @GetMapping("/trip-sheet/attention/count")
    @Operation(summary = "Count scheduled trips starting soon without a driver")
    public ResponseEntity<Integer> getTripsNeedingAttentionCount() {
        return ResponseEntity.ok(tripSheetService.getNeedsAttentionCount());
    }

    @GetMapping(value = "/trip-sheet/export", produces = "text/csv")
    @Operation(summary = "Export scheduled trips for a selected date as CSV")
    public ResponseEntity<byte[]> exportTripSheet(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("trip-sheet-" + date + ".csv").build().toString())
                .body(tripSheetService.exportCsv(date));
    }

    @PostMapping("/trip-sheet/{rideRequestId}/cancel")
    @Operation(summary = "Cancel an unassigned scheduled trip with a reason")
    public ResponseEntity<TripSheetRowDto> cancelTripSheetRide(
            @PathVariable Long rideRequestId,
            @Valid @RequestBody(required = false) TripSheetReasonRequestDto request) {
        return ResponseEntity.ok(tripSheetService.cancel(rideRequestId, request));
    }

    @PostMapping("/trip-sheet/{rideRequestId}/no-show")
    @Operation(summary = "Mark an assigned scheduled trip as a no-show")
    public ResponseEntity<TripSheetRowDto> markTripSheetNoShow(
            @PathVariable Long rideRequestId,
            @Valid @RequestBody(required = false) TripSheetReasonRequestDto request) {
        return ResponseEntity.ok(tripSheetService.markNoShow(rideRequestId, request));
    }

    @GetMapping("/dispatch/requests")
    @Operation(summary = "Get pending ride requests for operations dispatch")
    public ResponseEntity<Page<AdminPendingRideRequestDto>> getPendingRideRequests(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(adminDispatchService.getPendingRideRequests(pageRequest));
    }

    @PostMapping("/dispatch/requests")
    @Operation(summary = "Create a new dispatch request (supports DELIVERY_MERCHANT mode)")
    public ResponseEntity<com.velo.platform.dto.RideRequestDto> createDispatchRequest(
            @Valid @RequestBody AdminCreateDispatchRequestDto requestDto) {
        return ResponseEntity.ok(adminDispatchService.createDispatchRequest(requestDto));
    }

    @GetMapping("/dispatch/active-rides")
    @Operation(summary = "Get active rides available for operations override controls")
    public ResponseEntity<Page<AdminActiveRideDto>> getActiveRides(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(adminDispatchService.getActiveRides(pageRequest));
    }

    @GetMapping("/dispatch/live")
    @Tag(name = "Admin", description = "Admin management and analytics")
    @Operation(summary = "Get a tenant-scoped live dispatch snapshot")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<AdminLiveDispatchDto> getLiveDispatch() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(adminDispatchService.getLiveDispatch());
    }

    @GetMapping("/dispatch/recent-addresses")
    @Operation(summary = "Get pickup and drop-off locations from the tenant's 20 most recent trips")
    public ResponseEntity<List<GeocodingResultDto>> getRecentDispatchAddresses() {
        return ResponseEntity.ok(adminDispatchService.getRecentAddresses());
    }

    @GetMapping("/dispatch/requests/{rideRequestId}/offers")
    @Operation(summary = "Get driver offer lifecycle rows for a pending ride request")
    public ResponseEntity<List<AdminRideOfferDto>> getRideRequestOffers(@PathVariable Long rideRequestId) {
        return ResponseEntity.ok(adminDispatchService.getRideOffers(rideRequestId));
    }

    @GetMapping("/dispatch/audit")
    @Operation(summary = "Get operations override audit trail entries")
    public ResponseEntity<Page<AdminDispatchAuditDto>> getDispatchAudit(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(adminDispatchService.getDispatchAudit(pageRequest));
    }

    @PostMapping("/dispatch/requests/{rideRequestId}/assign")
    @Operation(summary = "Assign a pending ride request to a specific driver")
    public ResponseEntity<com.velo.platform.dto.RideDto> assignPendingRideRequest(
            @PathVariable Long rideRequestId,
            @Valid @RequestBody AdminDispatchActionRequestDto requestDto) {
        return ResponseEntity.ok(
                adminDispatchService.assignPendingRideRequest(rideRequestId, requestDto.getDriverId(), requestDto.getReason())
        );
    }

    @PostMapping("/dispatch/rides/{rideId}/reassign")
    @Operation(summary = "Reassign an active ride to a different driver")
    public ResponseEntity<com.velo.platform.dto.RideDto> reassignRide(
            @PathVariable Long rideId,
            @Valid @RequestBody AdminDispatchActionRequestDto requestDto) {
        return ResponseEntity.ok(adminDispatchService.reassignRide(rideId, requestDto.getDriverId(), requestDto.getReason()));
    }

    @PostMapping("/dispatch/requests/{rideRequestId}/cancel")
    @Operation(summary = "Force cancel a pending ride request")
    public ResponseEntity<com.velo.platform.dto.RideRequestDto> cancelPendingRideRequest(
            @PathVariable Long rideRequestId,
            @Valid @RequestBody AdminReasonRequestDto requestDto) {
        return ResponseEntity.ok(adminDispatchService.forceCancelRideRequest(rideRequestId, requestDto.getReason()));
    }

    @PostMapping("/dispatch/rides/{rideId}/cancel")
    @Operation(summary = "Force cancel an active ride")
    public ResponseEntity<com.velo.platform.dto.RideDto> cancelRide(
            @PathVariable Long rideId,
            @Valid @RequestBody AdminReasonRequestDto requestDto) {
        return ResponseEntity.ok(adminDispatchService.forceCancelRide(rideId, requestDto.getReason()));
    }

    @GetMapping("/ops-health")
    @Operation(summary = "Get operations health metrics including cache and dispatch queue state")
    public ResponseEntity<AdminOpsHealthDto> getOpsHealth() {
        return ResponseEntity.ok(adminDispatchService.getOpsHealth());
    }
}
