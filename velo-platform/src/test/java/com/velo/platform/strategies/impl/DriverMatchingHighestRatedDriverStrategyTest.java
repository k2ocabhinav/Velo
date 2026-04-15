package com.velo.platform.strategies.impl;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.repositories.DriverRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DriverMatchingHighestRatedDriverStrategyTest {

    @Mock
    private DriverRepository driverRepository;

    @InjectMocks
    private DriverMatchingHighestRatedDriverStrategy strategy;

    private final GeometryFactory geometryFactory = new GeometryFactory();

    @Test
    void shouldFallbackWhenPickupLocationIsUnavailable() {
        RideRequest rideRequest = RideRequest.builder()
                .tenantId(1L)
                .pickupLocation(null)
                .build();

        Driver fallbackDriver = Driver.builder().id(8L).available(true).build();
        when(driverRepository.findFallbackDrivers(1L, 10))
                .thenReturn(List.of(fallbackDriver));

        List<Driver> matched = strategy.findMatchingDrivers(rideRequest);

        assertThat(matched).extracting(Driver::getId).containsExactly(8L);
        verify(driverRepository).findFallbackDrivers(1L, 10);
    }

    @Test
    void shouldMergeTopRatedNearbyAndFallbackWithoutDuplicates() {
        Point pickup = geometryFactory.createPoint(new Coordinate(77.5946, 12.9716));
        RideRequest rideRequest = RideRequest.builder()
                .tenantId(1L)
                .pickupLocation(pickup)
                .build();

        Driver topRatedNearby = Driver.builder().id(3L).build();
        Driver fallbackDriver = Driver.builder().id(8L).build();
        Driver duplicateTopRated = Driver.builder().id(3L).build();

        when(driverRepository.findTenNearbyTopRatedDrivers(pickup, 1L))
                .thenReturn(List.of(topRatedNearby));
        when(driverRepository.findFallbackDrivers(1L, 10))
                .thenReturn(List.of(duplicateTopRated, fallbackDriver));

        List<Driver> matched = strategy.findMatchingDrivers(rideRequest);

        assertThat(matched).extracting(Driver::getId).containsExactly(3L, 8L);
    }
}
