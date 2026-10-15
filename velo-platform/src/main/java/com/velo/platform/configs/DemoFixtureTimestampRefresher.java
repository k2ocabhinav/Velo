package com.velo.platform.configs;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local")
@RequiredArgsConstructor
public class DemoFixtureTimestampRefresher implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        jdbcTemplate.update("""
                UPDATE ride_request
                SET requested_time = NOW() - INTERVAL '4 minutes'
                WHERE external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
                """);

        jdbcTemplate.update("""
                UPDATE ride_offer offer
                SET offered_at = NOW() - INTERVAL '1 minute',
                    expires_at = NOW() + INTERVAL '7 days'
                FROM ride_request request
                WHERE offer.ride_request_id = request.id
                  AND request.external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
                  AND offer.status = 'OFFERED'
                """);

        jdbcTemplate.update("""
                UPDATE ride
                SET created_time = NOW() - INTERVAL '18 minutes',
                    started_at = NOW() - INTERVAL '9 minutes'
                WHERE otp IN ('2468', '4826')
                  AND ride_status = 'ONGOING'
                """);

        jdbcTemplate.update("""
                UPDATE ride_request
                SET requested_time = NOW(),
                    scheduled_time = CASE external_reference
                        WHEN 'DEMO-SAFFRON-SCHEDULED-01' THEN NOW() + INTERVAL '2 hours'
                        ELSE NOW() + INTERVAL '4 hours'
                    END
                WHERE external_reference IN ('DEMO-SAFFRON-SCHEDULED-01', 'DEMO-SAFFRON-SCHEDULED-02')
                  AND ride_request_status = 'SCHEDULED'
                """);

        jdbcTemplate.update("""
                UPDATE ride_request
                SET scheduled_time = NOW() + (1 + MOD(id, 3)) * INTERVAL '1 hour'
                WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
                  AND ride_request_status = 'SCHEDULED'
                  AND external_reference IS NULL
                """);

        jdbcTemplate.update("""
                UPDATE ride
                SET created_time = NOW() - CASE otp
                        WHEN '1234' THEN INTERVAL '4 days'
                        WHEN '1357' THEN INTERVAL '3 days'
                        WHEN '1904' THEN INTERVAL '2 days'
                        WHEN '5182' THEN INTERVAL '2 days'
                        ELSE INTERVAL '1 day'
                    END,
                    started_at = NOW() - CASE otp
                        WHEN '1234' THEN INTERVAL '4 days' - INTERVAL '33 minutes'
                        WHEN '1357' THEN INTERVAL '3 days' - INTERVAL '33 minutes'
                        WHEN '1904' THEN INTERVAL '2 days' - INTERVAL '33 minutes'
                        WHEN '5182' THEN INTERVAL '2 days' - INTERVAL '33 minutes'
                        ELSE INTERVAL '1 day' - INTERVAL '33 minutes'
                    END,
                    ended_at = NOW() - CASE otp
                        WHEN '1234' THEN INTERVAL '4 days' - INTERVAL '58 minutes'
                        WHEN '1357' THEN INTERVAL '3 days' - INTERVAL '58 minutes'
                        WHEN '1904' THEN INTERVAL '2 days' - INTERVAL '58 minutes'
                        WHEN '5182' THEN INTERVAL '2 days' - INTERVAL '58 minutes'
                        ELSE INTERVAL '1 day' - INTERVAL '58 minutes'
                    END
                WHERE otp IN ('1234', '1357', '1904', '5182', '7394')
                  AND ride_status = 'ENDED'
                """);

        jdbcTemplate.update("""
                UPDATE payment payment
                SET payment_time = ride.ended_at + INTERVAL '1 minute'
                FROM ride
                WHERE payment.ride_id = ride.id
                  AND ride.otp IN ('1234', '1357', '1904', '5182', '7394')
                """);

        jdbcTemplate.update("""
                UPDATE driver_earning earning
                SET created_time = ride.ended_at
                FROM ride
                WHERE earning.ride_id = ride.id
                  AND ride.otp IN ('1234', '1357', '1904', '5182', '7394')
                """);
    }
}
