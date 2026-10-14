package com.velo.platform.controllers;

import com.velo.platform.dto.RecurringTripTemplateDto;
import com.velo.platform.dto.RecurringTripTemplateRequestDto;
import com.velo.platform.dto.admin.TripSheetRiderOptionDto;
import com.velo.platform.services.RecurringTripTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
@Tag(name = "Recurring trips", description = "Weekly scheduled trip templates")
@SecurityRequirement(name = "bearerAuth")
public class RecurringTripTemplateController {

    private final RecurringTripTemplateService templateService;

    @GetMapping("/admin/recurring-trip-templates")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List recurring trip templates for the current tenant")
    public ResponseEntity<Page<RecurringTripTemplateDto>> getTenantTemplates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(templateService.getTenantTemplates(PageRequest.of(page, size)));
    }

    @GetMapping("/admin/recurring-trip-templates/riders")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List riders available to a tenant administrator")
    public ResponseEntity<List<TripSheetRiderOptionDto>> getTenantRiders() {
        return ResponseEntity.ok(templateService.getTenantRiders());
    }

    @PostMapping("/admin/recurring-trip-templates")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a recurring trip template for a tenant rider")
    public ResponseEntity<RecurringTripTemplateDto> createTenantTemplate(
            @Valid @RequestBody RecurringTripTemplateRequestDto request) {
        return ResponseEntity.ok(templateService.createForTenant(request));
    }

    @PutMapping("/admin/recurring-trip-templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Edit a tenant recurring trip template and its future occurrences")
    public ResponseEntity<RecurringTripTemplateDto> updateTenantTemplate(
            @PathVariable Long id, @Valid @RequestBody RecurringTripTemplateRequestDto request) {
        return ResponseEntity.ok(templateService.updateForTenant(id, request));
    }

    @PostMapping("/admin/recurring-trip-templates/{id}/pause")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Pause a recurring trip template")
    public ResponseEntity<RecurringTripTemplateDto> pauseTenantTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(templateService.setTenantTemplateActive(id, false));
    }

    @PostMapping("/admin/recurring-trip-templates/{id}/resume")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Resume a recurring trip template")
    public ResponseEntity<RecurringTripTemplateDto> resumeTenantTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(templateService.setTenantTemplateActive(id, true));
    }

    @DeleteMapping("/admin/recurring-trip-templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete a recurring trip template")
    public ResponseEntity<Void> deleteTenantTemplate(@PathVariable Long id) {
        templateService.deleteTenantTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/riders/recurring-trip-templates")
    @PreAuthorize("hasRole('RIDER')")
    @Operation(summary = "List recurring trips belonging to the current rider")
    public ResponseEntity<Page<RecurringTripTemplateDto>> getMyTemplates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(templateService.getMyTemplates(PageRequest.of(page, size)));
    }

    @PostMapping("/riders/recurring-trip-templates")
    @PreAuthorize("hasRole('RIDER')")
    @Operation(summary = "Create a weekly recurring trip for the current rider")
    public ResponseEntity<RecurringTripTemplateDto> createMyTemplate(
            @Valid @RequestBody RecurringTripTemplateRequestDto request) {
        return ResponseEntity.ok(templateService.createForCurrentRider(request));
    }

    @PutMapping("/riders/recurring-trip-templates/{id}")
    @PreAuthorize("hasRole('RIDER')")
    @Operation(summary = "Edit a rider recurring trip and its future occurrences")
    public ResponseEntity<RecurringTripTemplateDto> updateMyTemplate(
            @PathVariable Long id, @Valid @RequestBody RecurringTripTemplateRequestDto request) {
        return ResponseEntity.ok(templateService.updateForCurrentRider(id, request));
    }

    @PostMapping("/riders/recurring-trip-templates/{id}/pause")
    @PreAuthorize("hasRole('RIDER')")
    @Operation(summary = "Pause one of the current rider's recurring trips")
    public ResponseEntity<RecurringTripTemplateDto> pauseMyTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(templateService.setMyTemplateActive(id, false));
    }

    @PostMapping("/riders/recurring-trip-templates/{id}/resume")
    @PreAuthorize("hasRole('RIDER')")
    @Operation(summary = "Resume one of the current rider's recurring trips")
    public ResponseEntity<RecurringTripTemplateDto> resumeMyTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(templateService.setMyTemplateActive(id, true));
    }

    @DeleteMapping("/riders/recurring-trip-templates/{id}")
    @PreAuthorize("hasRole('RIDER')")
    @Operation(summary = "Delete one of the current rider's recurring trips")
    public ResponseEntity<Void> deleteMyTemplate(@PathVariable Long id) {
        templateService.deleteMyTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
