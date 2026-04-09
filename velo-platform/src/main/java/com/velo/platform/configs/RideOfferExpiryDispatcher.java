package com.velo.platform.configs;

import com.velo.platform.services.RideOfferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.dispatch.offer-expiry-enabled", havingValue = "true", matchIfMissing = true)
public class RideOfferExpiryDispatcher {

    private final RideOfferService rideOfferService;

    @Scheduled(fixedRateString = "${app.dispatch.offer-expiry-interval-ms:15000}")
    public void expireStaleOffers() {
        int expired = rideOfferService.expireStaleOffers();
        if (expired > 0) {
            log.info("Ride offer expiry sweep marked {} offers expired", expired);
        }
    }
}
