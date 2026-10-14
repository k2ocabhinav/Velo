package com.velo.platform.services.impl;

import com.velo.platform.entities.Payment;
import com.velo.platform.entities.Ride;
import com.velo.platform.entities.Rider;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethod;
import com.velo.platform.entities.enums.RideStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.repositories.PaymentRepository;
import com.velo.platform.repositories.RideRepository;
import com.velo.platform.repositories.RiderRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.services.PaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PaymentPerRideIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private RiderRepository riderRepository;
    @Autowired private RideRepository rideRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private PaymentService paymentService;

    @Test
    void oneRiderCanCreatePaymentsForTwoDifferentRides() {
        User user = userRepository.save(User.builder()
                .email("repeat-rider-" + UUID.randomUUID() + "@test.com")
                .password("hash")
                .firstName("Repeat")
                .lastName("Rider")
                .roles(Set.of(Role.RIDER))
                .active(true)
                .tenantId(1L)
                .build());
        Rider rider = riderRepository.save(Rider.builder().user(user).rating(5.0).tenantId(1L).build());

        Ride firstRide = saveRide(rider, "42.00");
        Ride secondRide = saveRide(rider, "58.00");

        Payment firstPayment = paymentService.createNewPayment(firstRide);
        Payment secondPayment = paymentService.createNewPayment(secondRide);
        paymentRepository.flush();

        assertThat(firstPayment.getId()).isNotNull();
        assertThat(secondPayment.getId()).isNotNull().isNotEqualTo(firstPayment.getId());
        assertThat(paymentRepository.findAll()).filteredOn(payment -> payment.getUser().getId().equals(user.getId()))
                .hasSize(2);
    }

    private Ride saveRide(Rider rider, String fare) {
        return rideRepository.save(Ride.builder()
                .rider(rider)
                .rideStatus(RideStatus.ENDED)
                .paymentMethod(PaymentMethod.CASH)
                .fare(new BigDecimal(fare))
                .tenantId(1L)
                .build());
    }
}
