package com.velo.platform.services.impl;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.RideRequest;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.services.RideRequestService;
import org.junit.jupiter.api.Test;
import org.modelmapper.ModelMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RideServiceImplTest {

    @Test
    void createNewRideGeneratesFourDigitOtp() {
        RideRepository rideRepository = mock(RideRepository.class);
        RideRequestService rideRequestService = mock(RideRequestService.class);
        ModelMapper modelMapper = mock(ModelMapper.class);
        RideServiceImpl rideService = new RideServiceImpl(
                rideRepository, mock(com.velo.platform.repositories.RideRequestRepository.class),
                rideRequestService, modelMapper);

        RideRequest rideRequest = RideRequest.builder()
                .id(11L)
                .tenantId(1L)
                .rider(Rider.builder().user(User.builder().id(4L).build()).build())
                .build();
        when(modelMapper.map(rideRequest, Ride.class)).thenReturn(new Ride());
        when(rideRepository.save(any(Ride.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Ride ride = rideService.createNewRide(rideRequest, Driver.builder().id(8L).build());

        assertThat(ride.getOtp()).matches("\\d{4}");
    }
}
