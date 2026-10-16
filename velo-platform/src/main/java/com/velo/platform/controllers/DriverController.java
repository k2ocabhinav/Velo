package com.velo.platform.controllers;

import com.velo.platform.dto.*;
import com.velo.platform.services.DriverService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/drivers")
@Tag(name = "Driver", description = "Driver ride management")
@SecurityRequirement(name = "bearerAuth")
@Validated
public class DriverController {

    private final DriverService driverService;

    @PostMapping("/acceptRide/{rideRequestId}")
    @Operation(summary = "Accept a pending ride request")
    public ResponseEntity<RideDto> acceptRide(@PathVariable Long rideRequestId) {
        return ResponseEntity.ok(driverService.acceptRide(rideRequestId));
    }

    @GetMapping("/ride-requests/{rideRequestId}")
    @Operation(summary = "Get ride request details and current status before accepting")
    public ResponseEntity<RideRequestDto> getRideRequestForAcceptance(@PathVariable Long rideRequestId) {
        return ResponseEntity.ok(driverService.getRideRequestForAcceptance(rideRequestId));
    }

    @PostMapping("/startRide/{rideId}")
    @Operation(summary = "Start a ride after OTP verification")
    public ResponseEntity<RideDto> startRide(@PathVariable("rideId") Long rideId,
                                             @RequestBody RideStartDto rideStartDto) {
        return ResponseEntity.ok(driverService.startRide(rideId, rideStartDto.getOtp()));
    }

    @PostMapping("/endRide/{rideId}")
    @Operation(summary = "Complete an active ride")
    public ResponseEntity<RideDto> endRide(@PathVariable Long rideId) {
        return ResponseEntity.ok(driverService.endRide(rideId));
    }

    @PostMapping("/cancelRide/{rideId}")
    @Operation(summary = "Cancel an assigned ride")
    public ResponseEntity<RideDto> cancelRide(@PathVariable Long rideId) {
        return ResponseEntity.ok(driverService.cancelRide(rideId));
    }

    @PostMapping("/rateRider")
    @Operation(summary = "Rate a rider using a request body")
    public ResponseEntity<RiderDto> rateRider(@Valid @RequestBody RatingDto ratingDto) {
        return ResponseEntity.ok(driverService.rateRider(ratingDto.getRideId(), ratingDto.getRating()));
    }

    @GetMapping("/getMyProfile")
    @Operation(summary = "Get the current driver's profile")
    public ResponseEntity<DriverDto> getMyProfile() {
        return ResponseEntity.ok(driverService.getMyProfile());
    }

    @GetMapping("/getMyRides")
    @Operation(summary = "Get paginated ride history for the current driver")
    public ResponseEntity<Page<RideDto>> getAllMyRides(@RequestParam(defaultValue = "0") @Min(0) Integer pageOffset,
                                                       @RequestParam(defaultValue = "10", required = false) @Min(1) @Max(200) Integer pageSize) {
        PageRequest pageRequest = PageRequest.of(pageOffset, pageSize,
                Sort.by(Sort.Direction.DESC, "createdTime", "id"));
        return ResponseEntity.ok(driverService.getAllMyRides(pageRequest));
    }

    @PostMapping("/rateRider/{rideId}/{rating}")
    @Operation(summary = "Rate a rider using path variables")
    public ResponseEntity<RiderDto> rateRider(@PathVariable Long rideId,
                                              @PathVariable @Min(1) @Max(5) Integer rating) {
        return ResponseEntity.ok(driverService.rateRider(rideId, rating));
    }

    @PutMapping("/availability")
    @PreAuthorize("hasRole('DRIVER')")
    @Operation(summary = "Toggle driver availability status")
    public ResponseEntity<DriverDto> toggleAvailability(@RequestBody @Valid DriverAvailabilityRequestDto availabilityRequest) {
        return ResponseEntity.ok(driverService.updateDriverAvailability(availabilityRequest.getAvailable()));
    }

    @PutMapping("/location")
    @PreAuthorize("hasRole('DRIVER')")
    @Operation(summary = "Publish driver location updates for active ride tracking")
    public ResponseEntity<DriverLocationDto> updateDriverLocation(
            @RequestBody @Valid DriverLocationUpdateRequestDto locationUpdateRequest
    ) {
        return ResponseEntity.ok(driverService.updateDriverLocation(locationUpdateRequest));
    }
}
