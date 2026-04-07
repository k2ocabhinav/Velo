package com.velo.platform.repositories;

import com.velo.platform.dto.PointDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.utils.GeometryUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DriverRepositoryIntegrationTest {

    @Autowired private DriverRepository driverRepository;
    @Autowired private UserRepository userRepository;

    private static final double PICKUP_LONGITUDE = 77.5946;
    private static final double PICKUP_LATITUDE = 12.9716;

    @BeforeEach
    void setUp() {
        driverRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("findTenNearestDrivers should order by distance, ignore unavailable drivers, and cap the result set at ten")
    void findTenNearestDrivers_ShouldOrderAndLimitResults() {
        Driver pickupDriver = persistDriver("nearest-0@test.com", 0.0000, true, 4.1);
        Driver secondClosestDriver = persistDriver("nearest-1@test.com", 0.0010, true, 4.2);
        Driver thirdClosestDriver = persistDriver("nearest-2@test.com", 0.0020, true, 4.3);
        Driver fourthClosestDriver = persistDriver("nearest-3@test.com", 0.0030, true, 4.4);
        Driver fifthClosestDriver = persistDriver("nearest-4@test.com", 0.0040, true, 4.5);
        Driver sixthClosestDriver = persistDriver("nearest-5@test.com", 0.0050, true, 4.6);
        Driver seventhClosestDriver = persistDriver("nearest-6@test.com", 0.0060, true, 4.7);
        Driver eighthClosestDriver = persistDriver("nearest-7@test.com", 0.0070, true, 4.8);
        Driver ninthClosestDriver = persistDriver("nearest-8@test.com", 0.0080, true, 4.9);
        Driver tenthClosestDriver = persistDriver("nearest-9@test.com", 0.0090, true, 5.0);
        Driver ignoredEleventhDriver = persistDriver("nearest-ignored@test.com", 0.0100, true, 3.0);
        Driver unavailableDriver = persistDriver("nearest-unavailable@test.com", 0.0005, false, 5.0);
        Driver noLocationDriver = persistDriverWithoutLocation("nearest-null-location@test.com", true, 4.9);

        List<Long> driverIds = driverRepository.findTenNearestDrivers(pickupLocation()).stream()
                .map(Driver::getId)
                .toList();

        assertThat(driverIds).hasSize(10);
        assertThat(driverIds)
                .containsExactly(
                        pickupDriver.getId(),
                        secondClosestDriver.getId(),
                        thirdClosestDriver.getId(),
                        fourthClosestDriver.getId(),
                        fifthClosestDriver.getId(),
                        sixthClosestDriver.getId(),
                        seventhClosestDriver.getId(),
                        eighthClosestDriver.getId(),
                        ninthClosestDriver.getId(),
                        tenthClosestDriver.getId()
                );
        assertThat(driverIds).doesNotContain(
                ignoredEleventhDriver.getId(),
                unavailableDriver.getId(),
                noLocationDriver.getId()
        );
    }

    @Test
    @DisplayName("findTenNearbyTopRatedDrivers should return available nearby drivers ordered by rating descending")
    void findTenNearbyTopRatedDrivers_ShouldOrderByRatingDescending() {
        Driver lowerRatedDriver = persistDriver("top-rated-1@test.com", 0.0020, true, 4.4);
        Driver topRatedDriver = persistDriver("top-rated-2@test.com", 0.0030, true, 4.9);
        Driver middleRatedDriver = persistDriver("top-rated-3@test.com", 0.0010, true, 4.7);
        Driver lowestRatedDriver = persistDriver("top-rated-4@test.com", 0.0040, true, 4.1);
        Driver unavailableTopRatedDriver = persistDriver("top-rated-unavailable@test.com", 0.0005, false, 5.0);
        Driver farAwayTopRatedDriver = persistDriver("top-rated-far-away@test.com", 0.2000, true, 5.0);
        Driver noLocationTopRatedDriver = persistDriverWithoutLocation("top-rated-null-location@test.com", true, 5.0);

        List<Long> driverIds = driverRepository.findTenNearbyTopRatedDrivers(pickupLocation()).stream()
                .map(Driver::getId)
                .toList();

        assertThat(driverIds).containsExactly(
                topRatedDriver.getId(),
                middleRatedDriver.getId(),
                lowerRatedDriver.getId(),
                lowestRatedDriver.getId()
        );
        assertThat(driverIds).doesNotContain(
                unavailableTopRatedDriver.getId(),
                farAwayTopRatedDriver.getId(),
                noLocationTopRatedDriver.getId()
        );
    }

    private Driver persistDriver(String email, double latitudeOffset, boolean available, double rating) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("password123");
        user.setFirstName("Test");
        user.setLastName("Driver");
        user.setRoles(Set.of(Role.DRIVER));
        user.setActive(true);
        user = userRepository.saveAndFlush(user);

        Driver driver = new Driver();
        driver.setUser(user);
        driver.setAvailable(available);
        driver.setRating(rating);
        driver.setVehicleId(email.replace("@test.com", "").toUpperCase());
        driver.setCurrentLocation(GeometryUtil.createPoint(new PointDto(new double[]{
                PICKUP_LONGITUDE,
                PICKUP_LATITUDE + latitudeOffset
        })));
        return driverRepository.saveAndFlush(driver);
    }

    private Driver persistDriverWithoutLocation(String email, boolean available, double rating) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("password123");
        user.setFirstName("Test");
        user.setLastName("Driver");
        user.setRoles(Set.of(Role.DRIVER));
        user.setActive(true);
        user = userRepository.saveAndFlush(user);

        Driver driver = new Driver();
        driver.setUser(user);
        driver.setAvailable(available);
        driver.setRating(rating);
        driver.setVehicleId(email.replace("@test.com", "").toUpperCase());
        return driverRepository.saveAndFlush(driver);
    }

    private org.locationtech.jts.geom.Point pickupLocation() {
        return GeometryUtil.createPoint(new PointDto(new double[]{PICKUP_LONGITUDE, PICKUP_LATITUDE}));
    }

}
