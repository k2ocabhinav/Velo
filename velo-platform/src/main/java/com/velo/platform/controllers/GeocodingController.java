package com.velo.platform.controllers;

import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.services.GeocodingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/geo")
@RequiredArgsConstructor
@Validated
@Tag(name = "Geocoding", description = "Address search and reverse geocoding")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('RIDER', 'DRIVER', 'ADMIN')")
public class GeocodingController {
    private final GeocodingService geocodingService;

    @GetMapping("/search")
    @Operation(summary = "Search for an address", description = "Returns normalized address suggestions near an optional map location.")
    public List<GeocodingResultDto> search(
            @RequestParam @NotBlank @Size(max = 200) String q,
            @RequestParam(required = false) @Size(max = 100) String near) {
        return geocodingService.search(q, near);
    }

    @GetMapping("/reverse")
    @Operation(summary = "Resolve coordinates to an address", description = "Returns a normalized address for a latitude and longitude.")
    public GeocodingResultDto reverse(
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lon) {
        return geocodingService.reverse(lat, lon);
    }
}
