package com.velo.platform.controllers;

import com.velo.platform.dto.RiderSavedPlaceDto;
import com.velo.platform.dto.RiderSavedPlaceMutationDto;
import com.velo.platform.services.RiderSavedPlaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/riders/saved-places")
@RequiredArgsConstructor
@Tag(name = "Rider Saved Places", description = "Manage a rider's saved locations")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('RIDER')")
public class RiderSavedPlaceController {
    private final RiderSavedPlaceService savedPlaceService;

    @GetMapping
    @Operation(summary = "List saved places for the current rider")
    public List<RiderSavedPlaceDto> list() {
        return savedPlaceService.listSavedPlaces();
    }

    @PostMapping
    @Operation(summary = "Save a place for the current rider")
    public ResponseEntity<RiderSavedPlaceDto> create(@Valid @RequestBody RiderSavedPlaceMutationDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPlaceService.createSavedPlace(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a saved place owned by the current rider")
    public RiderSavedPlaceDto update(
            @PathVariable Long id,
            @Valid @RequestBody RiderSavedPlaceMutationDto request) {
        return savedPlaceService.updateSavedPlace(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a saved place owned by the current rider")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        savedPlaceService.deleteSavedPlace(id);
        return ResponseEntity.noContent().build();
    }
}
