package com.velo.platform.services;

import com.velo.platform.entities.Driver;
import com.velo.platform.entities.RideOffer;
import com.velo.platform.entities.RideRequest;

import java.util.List;
import java.util.Optional;

public interface RideOfferService {

    List<RideOffer> createOffers(RideRequest rideRequest, List<Driver> drivers);

    Optional<RideOffer> findAcceptableOffer(Long rideRequestId, Long driverId);

    boolean hasAnyOffer(Long rideRequestId);

    void markAccepted(RideOffer rideOffer);

    void markRevoked(RideOffer rideOffer, String reason);

    List<RideOffer> revokeCompetingOffers(Long rideRequestId, Long acceptedDriverId, String reason);

    List<RideOffer> revokeOpenOffers(Long rideRequestId, String reason);

    int expireStaleOffers();

    long countOpenOffers();

    long countOpenOffers(Long tenantId);

    long countExpiredOffers();

    long countExpiredOffers(Long tenantId);
}
