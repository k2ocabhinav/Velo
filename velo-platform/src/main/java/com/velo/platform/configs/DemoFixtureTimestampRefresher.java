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

    private static final String DEMO_TENANT_IDS = "SELECT id FROM tenant WHERE slug IN ('default', 'saffron-routes')";
    private static final String NON_FIXTURE_RIDE_IDS = """
            SELECT ride.id
            FROM ride
            JOIN tenant ON tenant.id = ride.tenant_id
            WHERE tenant.slug IN ('default', 'saffron-routes')
              AND NOT (
                  (tenant.slug = 'default' AND ride.otp IN ('1234', '1357', '1904', '2468', '5678'))
                  OR (tenant.slug = 'saffron-routes' AND ride.otp IN ('4826', '5182', '7394'))
              )
            """;
    private static final String NON_FIXTURE_REQUEST_IDS = """
            SELECT request.id
            FROM ride_request request
            JOIN tenant ON tenant.id = request.tenant_id
            WHERE tenant.slug IN ('default', 'saffron-routes')
              AND NOT (
                  (tenant.slug = 'default' AND COALESCE(request.external_reference, '') IN (
                      'DEMO-VELO-PENDING-01', 'DEMO-VELO-SCHEDULED-01', 'DEMO-VELO-SCHEDULED-02'
                  ))
                  OR (tenant.slug = 'saffron-routes' AND COALESCE(request.external_reference, '') IN (
                      'DEMO-SAFFRON-PENDING-01', 'DEMO-SAFFRON-SCHEDULED-01', 'DEMO-SAFFRON-SCHEDULED-02'
                  ))
              )
            """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        removePreviousDemoSessionData();
        restoreFixtureRequests();
        restoreFixtureRides();
        restoreFixtureOffers();
        restoreFixturePayments();
        restoreDemoWalletsAndDrivers();
        resetDemoNotifications();
    }

    private void removePreviousDemoSessionData() {
        jdbcTemplate.update("""
                DELETE FROM admin_dispatch_audit audit
                WHERE audit.ride_id IN (%s)
                   OR audit.ride_request_id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS, NON_FIXTURE_REQUEST_IDS));

        jdbcTemplate.update("""
                DELETE FROM ride_offer
                WHERE ride_request_id IN (%s)
                """.formatted(NON_FIXTURE_REQUEST_IDS));

        jdbcTemplate.update("""
                DELETE FROM promo_code_usage
                WHERE ride_id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM wallet_transaction
                WHERE ride_id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM rating
                WHERE ride_id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM payment
                WHERE ride_id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM driver_earning
                WHERE ride_id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM ride
                WHERE id IN (%s)
                """.formatted(NON_FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM ride_request
                WHERE id IN (%s)
                """.formatted(NON_FIXTURE_REQUEST_IDS));
    }

    private void restoreFixtureRequests() {
        jdbcTemplate.update("""
                UPDATE ride_request request
                SET ride_request_status = 'PENDING',
                    requested_time = NOW() - INTERVAL '4 minutes',
                    scheduled_time = NULL
                FROM tenant
                WHERE request.tenant_id = tenant.id
                  AND ((tenant.slug = 'default' AND request.external_reference = 'DEMO-VELO-PENDING-01')
                    OR (tenant.slug = 'saffron-routes' AND request.external_reference = 'DEMO-SAFFRON-PENDING-01'))
                """);

        jdbcTemplate.update("""
                UPDATE ride_request request
                SET ride_request_status = 'SCHEDULED',
                    requested_time = NOW(),
                    scheduled_time = CASE request.external_reference
                        WHEN 'DEMO-VELO-SCHEDULED-01' THEN NOW() + INTERVAL '1 day'
                        WHEN 'DEMO-VELO-SCHEDULED-02' THEN NOW() + INTERVAL '3 days'
                        WHEN 'DEMO-SAFFRON-SCHEDULED-01' THEN NOW() + INTERVAL '2 hours'
                        ELSE NOW() + INTERVAL '4 hours'
                    END
                WHERE request.tenant_id IN (%s)
                  AND request.external_reference IN (
                      'DEMO-VELO-SCHEDULED-01', 'DEMO-VELO-SCHEDULED-02',
                      'DEMO-SAFFRON-SCHEDULED-01', 'DEMO-SAFFRON-SCHEDULED-02'
                  )
                """.formatted(DEMO_TENANT_IDS));
    }

    private void restoreFixtureRides() {
        jdbcTemplate.update("""
                UPDATE ride
                SET rider_id = (
                        SELECT rider.id FROM rider
                        JOIN app_user ON app_user.id = rider.user_id
                        JOIN tenant ON tenant.id = rider.tenant_id
                        WHERE tenant.slug = 'default' AND app_user.email = 'alice@example.com'
                    ),
                    driver_id = (
                        SELECT driver.id FROM driver
                        JOIN app_user ON app_user.id = driver.user_id
                        JOIN tenant ON tenant.id = driver.tenant_id
                        WHERE tenant.slug = 'default' AND app_user.email = 'carol.driver@example.com'
                    ),
                    pickup_location = ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
                    drop_off_location = ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326),
                    created_time = NOW() - INTERVAL '18 minutes',
                    started_at = NOW() - INTERVAL '9 minutes',
                    ended_at = NULL,
                    payment_method = 'CASH',
                    ride_status = 'ONGOING',
                    fare = 640.00
                WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
                  AND otp = '2468'
                """);

        jdbcTemplate.update("""
                UPDATE ride
                SET rider_id = (
                        SELECT rider.id FROM rider
                        JOIN app_user ON app_user.id = rider.user_id
                        JOIN tenant ON tenant.id = rider.tenant_id
                        WHERE tenant.slug = 'saffron-routes' AND app_user.email = 'guest@saffronroutes.demo'
                    ),
                    driver_id = (
                        SELECT driver.id FROM driver
                        JOIN app_user ON app_user.id = driver.user_id
                        JOIN tenant ON tenant.id = driver.tenant_id
                        WHERE tenant.slug = 'saffron-routes' AND app_user.email = 'chauffeur2@saffronroutes.demo'
                    ),
                    pickup_location = ST_SetSRID(ST_MakePoint(77.6100, 12.9350), 4326),
                    drop_off_location = ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326),
                    created_time = NOW() - INTERVAL '16 minutes',
                    started_at = NOW() - INTERVAL '7 minutes',
                    ended_at = NULL,
                    payment_method = 'CASH',
                    ride_status = 'ONGOING',
                    fare = 1580.00
                WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'saffron-routes')
                  AND otp = '4826'
                """);

        jdbcTemplate.update("""
                UPDATE ride
                SET ride_status = 'ENDED',
                    created_time = NOW() - CASE otp
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
                WHERE (tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
                       AND otp IN ('1234', '1357', '1904'))
                   OR (tenant_id = (SELECT id FROM tenant WHERE slug = 'saffron-routes')
                       AND otp IN ('5182', '7394'))
                """);

        jdbcTemplate.update("""
                UPDATE ride
                SET ride_status = 'CANCELLED', started_at = NULL, ended_at = NULL
                WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
                  AND otp = '5678'
                """);
    }

    private void restoreFixtureOffers() {
        jdbcTemplate.update("""
                DELETE FROM ride_offer
                WHERE ride_request_id IN (
                    SELECT id FROM ride_request
                    WHERE external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
                      AND tenant_id IN (%s)
                )
                """.formatted(DEMO_TENANT_IDS));

        jdbcTemplate.update("""
                INSERT INTO ride_offer (
                    ride_request_id, driver_id, status, offered_at, expires_at, version, tenant_id
                )
                SELECT request.id, driver.id, 'OFFERED', NOW() - INTERVAL '1 minute',
                       NOW() + INTERVAL '7 days', 0, tenant.id
                FROM ride_request request
                JOIN tenant ON tenant.id = request.tenant_id
                JOIN app_user driver_user ON driver_user.email = CASE tenant.slug
                    WHEN 'default' THEN 'bob.driver@example.com'
                    ELSE 'chauffeur1@saffronroutes.demo'
                END
                JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
                WHERE (tenant.slug = 'default' AND request.external_reference = 'DEMO-VELO-PENDING-01')
                   OR (tenant.slug = 'saffron-routes' AND request.external_reference = 'DEMO-SAFFRON-PENDING-01')
                """);
    }

    private void restoreFixturePayments() {
        jdbcTemplate.update("""
                UPDATE payment payment
                SET payment_method = ride.payment_method,
                    user_id = rider.user_id,
                    amount = ride.fare,
                    payment_status = CASE ride.ride_status WHEN 'ENDED' THEN 'CONFIRMED' ELSE 'PENDING' END,
                    payment_time = CASE WHEN ride.ride_status = 'ENDED' THEN ride.ended_at + INTERVAL '1 minute' ELSE NULL END,
                    tenant_id = ride.tenant_id
                FROM ride
                JOIN rider ON rider.id = ride.rider_id AND rider.tenant_id = ride.tenant_id
                WHERE payment.ride_id = ride.id
                  AND ((ride.tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
                        AND ride.otp IN ('1234', '1357', '1904', '2468'))
                    OR (ride.tenant_id = (SELECT id FROM tenant WHERE slug = 'saffron-routes')
                        AND ride.otp IN ('4826', '5182', '7394')))
                """);

        jdbcTemplate.update("""
                INSERT INTO payment (
                    payment_method, user_id, ride_id, amount, payment_status, payment_time, version, tenant_id
                )
                SELECT ride.payment_method, rider.user_id, ride.id, ride.fare,
                       CASE ride.ride_status WHEN 'ENDED' THEN 'CONFIRMED' ELSE 'PENDING' END,
                       CASE WHEN ride.ride_status = 'ENDED' THEN ride.ended_at + INTERVAL '1 minute' ELSE NULL END,
                       0, ride.tenant_id
                FROM ride
                JOIN rider ON rider.id = ride.rider_id AND rider.tenant_id = ride.tenant_id
                WHERE ((ride.tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
                       AND ride.otp IN ('1234', '1357', '1904', '2468'))
                    OR (ride.tenant_id = (SELECT id FROM tenant WHERE slug = 'saffron-routes')
                       AND ride.otp IN ('4826', '5182', '7394')))
                  AND ride.ride_status IN ('ONGOING', 'ENDED')
                  AND NOT EXISTS (SELECT 1 FROM payment WHERE payment.ride_id = ride.id)
                """);
    }

    private void restoreDemoWalletsAndDrivers() {
        jdbcTemplate.update("""
                UPDATE wallet
                SET balance = CASE app_user.email
                    WHEN 'henry@example.com' THEN 2500.00
                    WHEN 'guest@saffronroutes.demo' THEN 25000.00
                    WHEN 'guest2@saffronroutes.demo' THEN 25000.00
                    ELSE wallet.balance
                END
                FROM app_user
                JOIN tenant ON tenant.id = app_user.tenant_id
                WHERE wallet.user_id = app_user.id
                  AND tenant.slug IN ('default', 'saffron-routes')
                  AND app_user.email IN ('henry@example.com', 'guest@saffronroutes.demo', 'guest2@saffronroutes.demo')
                """);

        jdbcTemplate.update("""
                UPDATE driver
                SET available = CASE app_user.email
                    WHEN 'bob.driver@example.com' THEN TRUE
                    WHEN 'carol.driver@example.com' THEN FALSE
                    WHEN 'chauffeur1@saffronroutes.demo' THEN TRUE
                    ELSE FALSE
                END
                FROM app_user
                JOIN tenant ON tenant.id = app_user.tenant_id
                WHERE driver.user_id = app_user.id
                  AND driver.tenant_id = tenant.id
                  AND tenant.slug IN ('default', 'saffron-routes')
                  AND app_user.email IN (
                      'bob.driver@example.com', 'carol.driver@example.com',
                      'chauffeur1@saffronroutes.demo', 'chauffeur2@saffronroutes.demo'
                  )
                """);
    }

    private void resetDemoNotifications() {
        jdbcTemplate.update("DELETE FROM notification WHERE tenant_id IN (%s)".formatted(DEMO_TENANT_IDS));

        jdbcTemplate.update("""
                INSERT INTO notification (user_id, title, message, type, reference_id, read, created_time, version, tenant_id)
                SELECT app_user.id,
                       CASE tenant.slug WHEN 'default' THEN 'New ride offer' ELSE 'New transfer offer' END,
                       CASE tenant.slug
                           WHEN 'default' THEN 'A rider requested a trip. Review and accept it.'
                           ELSE 'A guest requested a transfer. Review and accept it.'
                       END,
                       'RIDE_REQUESTED', request.id, FALSE, NOW(), 0, tenant.id
                FROM ride_request request
                JOIN tenant ON tenant.id = request.tenant_id
                JOIN app_user ON app_user.email = CASE tenant.slug
                    WHEN 'default' THEN 'bob.driver@example.com'
                    ELSE 'chauffeur1@saffronroutes.demo'
                END
                WHERE (tenant.slug = 'default' AND request.external_reference = 'DEMO-VELO-PENDING-01')
                   OR (tenant.slug = 'saffron-routes' AND request.external_reference = 'DEMO-SAFFRON-PENDING-01')
                """);
    }
}
