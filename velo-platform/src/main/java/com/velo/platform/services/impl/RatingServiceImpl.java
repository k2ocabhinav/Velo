package com.velo.platform.services.impl;

import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.RiderDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Rating;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
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
                .mapToDouble(Rating::getDriverRating)
                .average().orElse(0.0);
        driver.setRating(newRating);

        Driver savedDriver = driverRepository.save(driver);
        return modelMapper.map(savedDriver, DriverDto.class);
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
                .mapToDouble(Rating::getRiderRating)
                .average().orElse(0.0);
        rider.setRating(newRating);

        Rider savedRider = riderRepository.save(rider);
        return modelMapper.map(savedRider, RiderDto.class);
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
