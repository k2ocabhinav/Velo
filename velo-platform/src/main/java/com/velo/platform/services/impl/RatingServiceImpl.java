package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.RideDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Rating;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.DriverRepository;
import com.velo.platform.repositories.RatingRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.services.RatingService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RatingServiceImpl implements RatingService {

    private final RatingRepository ratingRepository;
    private final DriverRepository driverRepository;
    private final RiderRepository riderRepository;
    private final ModelMapper modelMapper;

    @Override
    @Transactional
    public DriverDto rateDriver(Ride ride, Integer rating) {
        Driver driver = ride.getDriver();
        Rating ratingObj = ratingRepository.findByRide(ride)
                .orElseThrow(() -> new ResourceNotFoundException("Rating not found for ride with id: "+ride.getId()));

        if(ratingObj.getDriverRating() != null)
            throw new RuntimeConflictException("Driver has already been rated, cannot rate again");

        ratingObj.setDriverRating(rating);

        ratingRepository.save(ratingObj);

        Double newRating = ratingRepository.findByDriver(driver)
                .stream()
                .map(Rating::getDriverRating)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average().orElse(0.0);
        driver.setRating(newRating);

        Driver savedDriver = driverRepository.save(driver);
        DriverDto driverDto = modelMapper.map(savedDriver, DriverDto.class);
        driverDto.setUser(savedDriver.getUser() == null ? null : namedUser(savedDriver.getUser()));
        return driverDto;
    }

    @Override
    @Transactional
    public RiderDto rateRider(Ride ride, Integer rating) {
        Rider rider = ride.getRider();
        Rating ratingObj = ratingRepository.findByRide(ride)
                .orElseThrow(() -> new ResourceNotFoundException("Rating not found for ride with id: "+ride.getId()));
        if(ratingObj.getRiderRating() != null)
            throw new RuntimeConflictException("Rider has already been rated, cannot rate again");

        ratingObj.setRiderRating(rating);

        ratingRepository.save(ratingObj);

        Double newRating = ratingRepository.findByRider(rider)
                .stream()
                .map(Rating::getRiderRating)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average().orElse(0.0);
        rider.setRating(newRating);

        Rider savedRider = riderRepository.save(rider);
        RiderDto riderDto = modelMapper.map(savedRider, RiderDto.class);
        riderDto.setUser(savedRider.getUser() == null ? null : namedUser(savedRider.getUser()));
        return riderDto;
    }

    private UserDto namedUser(User user) {
        UserDto userDto = new UserDto();
        userDto.setEmail(user.getEmail());
        userDto.setRoles(user.getRoles());
        String name = ((user.getFirstName() == null ? "" : user.getFirstName().trim()) + " "
                + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        userDto.setName(name.isEmpty() ? null : name);
        return userDto;
    }

    @Override
    @Transactional(readOnly = true)
    public void applyRideRatingFlags(List<RideDto> rides) {
        if (rides == null || rides.isEmpty()) {
            return;
        }
        List<Long> rideIds = rides.stream().map(RideDto::getId).filter(Objects::nonNull).toList();
        if (rideIds.isEmpty()) {
            return;
        }
        Map<Long, Rating> byRideId = ratingRepository.findByRideIdIn(rideIds).stream()
                .collect(Collectors.toMap(rating -> rating.getRide().getId(), Function.identity(), (first, second) -> first));
        for (RideDto ride : rides) {
            Rating rating = byRideId.get(ride.getId());
            ride.setDriverRated(rating != null && rating.getDriverRating() != null);
            ride.setRiderRated(rating != null && rating.getRiderRating() != null);
        }
    }

    @Override
    @Transactional
    public void createNewRating(Ride ride) {
        Rating rating = Rating.builder()
                .rider(ride.getRider())
                .driver(ride.getDriver())
                .ride(ride)
                .build();
        ratingRepository.save(rating);
    }
}
