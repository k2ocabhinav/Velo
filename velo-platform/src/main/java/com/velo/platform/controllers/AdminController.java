package com.velo.platform.controllers;

import com.velo.platform.dto.admin.AdminStatsDto;
import com.velo.platform.dto.admin.AdminDispatchActionRequestDto;
import com.velo.platform.dto.admin.AdminDispatchAuditDto;
import com.velo.platform.dto.admin.AdminOpsHealthDto;
import com.velo.platform.dto.admin.AdminPendingRideRequestDto;
import com.velo.platform.dto.admin.AdminActiveRideDto;
import com.velo.platform.dto.admin.AdminReasonRequestDto;
import com.velo.platform.dto.admin.AdminRideOfferDto;
import com.velo.platform.dto.admin.DashboardDto;
import com.velo.platform.dto.admin.PendingDriverDto;
import com.velo.platform.dto.admin.RevenueReportDto;
import com.velo.platform.entities.User;
import com.velo.platform.services.AdminDispatchService;
import com.velo.platform.services.AdminService;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin", description = "Admin management and analytics")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final AdminDispatchService adminDispatchService;
    private final PayoutService payoutService;
    private final com.velo.platform.services.ScheduledRideService scheduledRideService;

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

    @GetMapping("/drivers/pending")
    @Operation(summary = "Get pending driver approvals")
    public ResponseEntity<Page<PendingDriverDto>> getPendingDrivers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(adminService.getPendingDrivers(pageRequest));
    }

    @PostMapping("/drivers/{id}/approve")
    @Operation(summary = "Approve a driver")
    public ResponseEntity<Void> approveDriver(@PathVariable Long id) {
        adminService.approveDriver(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/drivers/{id}/reject")
    @Operation(summary = "Reject a driver")
    public ResponseEntity<Void> rejectDriver(@PathVariable Long id, @RequestBody String reason) {
        adminService.rejectDriver(id, reason);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/users")
    @Operation(summary = "Get all users")
    public ResponseEntity<Page<User>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
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
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "requestedAt"));
        return ResponseEntity.ok(payoutService.getPendingPayouts(pageRequest));
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
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(scheduledRideService.getAllScheduledRides(pageRequest));
    }

    @GetMapping("/dispatch/requests")
    @Operation(summary = "Get pending ride requests for operations dispatch")
    public ResponseEntity<Page<AdminPendingRideRequestDto>> getPendingRideRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(adminDispatchService.getPendingRideRequests(pageRequest));
    }

    @GetMapping("/dispatch/active-rides")
    @Operation(summary = "Get active rides available for operations override controls")
    public ResponseEntity<Page<AdminActiveRideDto>> getActiveRides(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(adminDispatchService.getActiveRides(pageRequest));
    }

    @GetMapping("/dispatch/requests/{rideRequestId}/offers")
    @Operation(summary = "Get driver offer lifecycle rows for a pending ride request")
    public ResponseEntity<List<AdminRideOfferDto>> getRideRequestOffers(@PathVariable Long rideRequestId) {
        return ResponseEntity.ok(adminDispatchService.getRideOffers(rideRequestId));
    }

    @GetMapping("/dispatch/audit")
    @Operation(summary = "Get operations override audit trail entries")
    public ResponseEntity<Page<AdminDispatchAuditDto>> getDispatchAudit(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
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
