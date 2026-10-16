package com.velo.platform.services.impl;

import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.services.GeocodingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RideRequestAddressResolverTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Mock
    private GeocodingService geocodingService;

    @InjectMocks
    private RideRequestAddressResolver resolver;

    @Test
    @DisplayName("A request created from coordinates only gains short reverse-geocoded labels")
    void fillMissingLabels_ShouldReverseGeocodeBothPoints() {
        RideRequest request = request(point(12.9716, 77.5946), point(12.9352, 77.6245), null, null);
        when(geocodingService.reverse(12.9716, 77.5946)).thenReturn(result("MG Road, Bengaluru", 12.9716, 77.5946));
        when(geocodingService.reverse(12.9352, 77.6245)).thenReturn(result("Koramangala, Bengaluru", 12.9352, 77.6245));

        resolver.fillMissingLabels(request);

        assertThat(request.getPickupAddress()).isEqualTo("MG Road, Bengaluru");
        assertThat(request.getDropOffAddress()).isEqualTo("Koramangala, Bengaluru");
    }

    @Test
    @DisplayName("Only the side without a label is reverse geocoded")
    void fillMissingLabels_ShouldKeepProvidedLabels() {
        RideRequest request = request(point(12.9716, 77.5946), point(12.9352, 77.6245), "Kempegowda International Airport", null);
        when(geocodingService.reverse(12.9352, 77.6245)).thenReturn(result("Koramangala, Bengaluru", 12.9352, 77.6245));

        resolver.fillMissingLabels(request);

        assertThat(request.getPickupAddress()).isEqualTo("Kempegowda International Airport");
        assertThat(request.getDropOffAddress()).isEqualTo("Koramangala, Bengaluru");
        verify(geocodingService, never()).reverse(12.9716, 77.5946);
    }

    @Test
    @DisplayName("Provided labels are trimmed and blank labels count as missing")
    void fillMissingLabels_ShouldNormalizeProvidedLabels() {
        RideRequest request = request(point(12.9716, 77.5946), point(12.9352, 77.6245), "  MG Road  ", "   ");
        when(geocodingService.reverse(12.9352, 77.6245)).thenReturn(result("Koramangala, Bengaluru", 12.9352, 77.6245));

        resolver.fillMissingLabels(request);

        assertThat(request.getPickupAddress()).isEqualTo("MG Road");
        assertThat(request.getDropOffAddress()).isEqualTo("Koramangala, Bengaluru");
    }

    @Test
    @DisplayName("A geocoding failure leaves the label empty instead of failing the request")
    void fillMissingLabels_ShouldSwallowGeocodingFailures() {
        RideRequest request = request(point(12.9716, 77.5946), point(12.9352, 77.6245), null, null);
        when(geocodingService.reverse(anyDouble(), anyDouble())).thenThrow(new GeocodingUnavailableException());

        resolver.fillMissingLabels(request);

        assertThat(request.getPickupAddress()).isNull();
        assertThat(request.getDropOffAddress()).isNull();
    }

    @Test
    @DisplayName("A request without points is left untouched")
    void fillMissingLabels_ShouldNotGeocodeWithoutAPoint() {
        RideRequest request = request(null, null, null, null);

        resolver.fillMissingLabels(request);

        assertThat(request.getPickupAddress()).isNull();
        assertThat(request.getDropOffAddress()).isNull();
        verify(geocodingService, never()).reverse(anyDouble(), anyDouble());
    }

    private static RideRequest request(Point pickup, Point dropOff, String pickupAddress, String dropOffAddress) {
        return RideRequest.builder()
                .pickupLocation(pickup)
                .dropOffLocation(dropOff)
                .pickupAddress(pickupAddress)
                .dropOffAddress(dropOffAddress)
                .build();
    }

    private static Point point(double latitude, double longitude) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(longitude, latitude));
    }

    private static GeocodingResultDto result(String label, double latitude, double longitude) {
        return new GeocodingResultDto(label, label + ", Karnataka, India", latitude, longitude, "address");
    }
}
