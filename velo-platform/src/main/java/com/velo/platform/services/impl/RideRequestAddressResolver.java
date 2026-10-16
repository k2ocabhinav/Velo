package com.velo.platform.services.impl;

import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.services.GeocodingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Point;
import org.springframework.stereotype.Service;

/**
 * Fills the pickup and drop-off labels of a ride request by reverse geocoding its points.
 *
 * <p>Requests created with coordinates only (API clients, operations console) then read as places
 * on driver and admin surfaces instead of raw latitude and longitude. A geocoding failure never
 * fails the request: the label stays empty and the UI falls back to its own pending wording.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RideRequestAddressResolver {

    private final GeocodingService geocodingService;

    public void fillMissingLabels(RideRequest rideRequest) {
        rideRequest.setPickupAddress(resolveLabel(rideRequest.getPickupAddress(), rideRequest.getPickupLocation()));
        rideRequest.setDropOffAddress(resolveLabel(rideRequest.getDropOffAddress(), rideRequest.getDropOffLocation()));
    }

    private String resolveLabel(String address, Point point) {
        String label = normalize(address);
        if (label != null || point == null) {
            return label;
        }

        try {
            GeocodingResultDto result = geocodingService.reverse(point.getY(), point.getX());
            return result == null ? null : normalize(result.label());
        } catch (RuntimeException exception) {
            log.debug("Reverse geocoding a ride request point failed; using the UI fallback label.", exception);
            return null;
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
