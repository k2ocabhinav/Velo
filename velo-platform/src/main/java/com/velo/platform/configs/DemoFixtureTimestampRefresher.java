package com.velo.platform.configs;

import com.velo.platform.services.TenantBrandingCacheService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.DatabasePopulatorUtils;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;

@Component
@Profile("local")
@RequiredArgsConstructor
public class DemoFixtureTimestampRefresher implements ApplicationRunner {

    private static final String DEMO_TENANT_IDS = "SELECT id FROM tenant WHERE slug IN ('default', 'saffron-routes')";
    private static final String FIXTURE_REQUEST_IDS = """
            SELECT request.id
            FROM ride_request request
            JOIN tenant ON tenant.id = request.tenant_id
            WHERE (tenant.slug = 'default' AND request.external_reference IN (
                      'DEMO-VELO-PENDING-01', 'DEMO-VELO-SCHEDULED-01', 'DEMO-VELO-SCHEDULED-02',
                      'DEMO-VELO-RIDE-ENDED-01', 'DEMO-VELO-RIDE-CANCELLED-01', 'DEMO-VELO-RIDE-ONGOING-01',
                      'DEMO-VELO-RIDE-ENDED-02', 'DEMO-VELO-RIDE-ENDED-03'
                  ))
               OR (tenant.slug = 'saffron-routes' AND request.external_reference IN (
                      'DEMO-SAFFRON-PENDING-01', 'DEMO-SAFFRON-SCHEDULED-01', 'DEMO-SAFFRON-SCHEDULED-02',
                      'DEMO-SAFFRON-RIDE-ENDED-01', 'DEMO-SAFFRON-RIDE-ENDED-02', 'DEMO-SAFFRON-RIDE-ONGOING-01'
                  ))
            """;
    private static final String FIXTURE_RIDE_IDS = """
            SELECT ride.id
            FROM ride
            JOIN tenant ON tenant.id = ride.tenant_id
            WHERE (tenant.slug = 'default' AND ride.external_reference IN (
                      'DEMO-VELO-ENDED-01', 'DEMO-VELO-CANCELLED-01', 'DEMO-VELO-ONGOING-01',
                      'DEMO-VELO-ENDED-02', 'DEMO-VELO-ENDED-03'
                  ))
               OR (tenant.slug = 'saffron-routes' AND ride.external_reference IN (
                      'DEMO-SAFFRON-ENDED-01', 'DEMO-SAFFRON-ENDED-02', 'DEMO-SAFFRON-ONGOING-01'
                  ))
            """;

    private final JdbcTemplate jdbcTemplate;
    private final TenantBrandingCacheService tenantBrandingCacheService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        removeNonFixtureDemoData();
        repairFixtureRows();
        restoreFixtureOffers();
        restoreFixturePayments();
        restorePresenterWallets();
        restorePresenterDrivers();
        resetSimulatedFleetState();
        resetDemoNotifications();
        tenantBrandingCacheService.evict("default");
        tenantBrandingCacheService.evict("saffron-routes");
    }

    private void removeNonFixtureDemoData() {
        jdbcTemplate.update("DELETE FROM admin_dispatch_audit WHERE tenant_id IN (%s)".formatted(DEMO_TENANT_IDS));
        jdbcTemplate.update("""
                DELETE FROM ride_offer
                WHERE tenant_id IN (%s)
                  AND ride_request_id NOT IN (
                      SELECT request.id FROM ride_request request
                      WHERE request.tenant_id IN (%s)
                        AND request.external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
                  )
                """.formatted(DEMO_TENANT_IDS, DEMO_TENANT_IDS));
        jdbcTemplate.update("DELETE FROM promo_code_usage WHERE tenant_id IN (%s) AND (ride_id IS NULL OR ride_id NOT IN (%s))"
                .formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
        jdbcTemplate.update("DELETE FROM wallet_transaction WHERE tenant_id IN (%s) AND (ride_id IS NULL OR ride_id NOT IN (%s))"
                .formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
        jdbcTemplate.update("""
                DELETE FROM rating
                WHERE ride_id IN (
                    SELECT ride.id FROM ride
                    WHERE ride.tenant_id IN (%s) AND ride.id NOT IN (%s)
                )
                """.formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
        jdbcTemplate.update("DELETE FROM payment WHERE tenant_id IN (%s) AND (ride_id IS NULL OR ride_id NOT IN (%s))"
                .formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
        jdbcTemplate.update("DELETE FROM driver_earning WHERE tenant_id IN (%s) AND ride_id NOT IN (%s)"
                .formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
        jdbcTemplate.update("DELETE FROM ride WHERE tenant_id IN (%s) AND id NOT IN (%s)"
                .formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
        jdbcTemplate.update("DELETE FROM ride_request WHERE tenant_id IN (%s) AND id NOT IN (%s)"
                .formatted(DEMO_TENANT_IDS, FIXTURE_REQUEST_IDS));
    }

    private void repairFixtureRows() {
        DataSource dataSource = jdbcTemplate.getDataSource();
        if (dataSource == null) {
            throw new IllegalStateException("The demo fixture refresher requires a configured data source.");
        }
        DatabasePopulatorUtils.execute(
                new ResourceDatabasePopulator(new ClassPathResource("db/demo-migration/demo_fixture_repair.sql")),
                dataSource);
    }

    private void restoreFixtureOffers() {
        jdbcTemplate.update("""
                DELETE FROM ride_offer
                WHERE tenant_id IN (%s)
                  AND ride_request_id IN (
                      SELECT id FROM ride_request
                      WHERE tenant_id IN (%s)
                        AND external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
                  )
                """.formatted(DEMO_TENANT_IDS, DEMO_TENANT_IDS));
        jdbcTemplate.update("""
                INSERT INTO ride_offer (
                    ride_request_id, driver_id, status, offered_at, expires_at, version, tenant_id
                )
                SELECT request.id, driver.id, 'OFFERED', NOW(), NOW() + INTERVAL '90 seconds', 0, tenant.id
                FROM ride_request request
                JOIN tenant ON tenant.id = request.tenant_id
                JOIN app_user driver_user ON driver_user.email = CASE tenant.slug
                    WHEN 'default' THEN 'carol.driver@example.com'
                    ELSE 'chauffeur2@saffronroutes.demo'
                END AND driver_user.tenant_id = tenant.id
                JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
                WHERE (tenant.slug = 'default' AND request.external_reference = 'DEMO-VELO-PENDING-01')
                   OR (tenant.slug = 'saffron-routes' AND request.external_reference = 'DEMO-SAFFRON-PENDING-01')
                """);
    }

    private void restoreFixturePayments() {
        jdbcTemplate.update("DELETE FROM payment WHERE tenant_id IN (%s) AND ride_id IN (%s)"
                .formatted(DEMO_TENANT_IDS, FIXTURE_RIDE_IDS));
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
                WHERE ride.id IN (%s)
                  AND ride.ride_status IN ('ONGOING', 'ENDED')
                """.formatted(FIXTURE_RIDE_IDS));
    }

    private void restorePresenterDrivers() {
        jdbcTemplate.update("""
                UPDATE driver
                SET available = FALSE
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

    private void restorePresenterWallets() {
        jdbcTemplate.update("""
                UPDATE wallet
                SET balance = CASE app_user.email
                    WHEN 'henry@example.com' THEN 2500.00
                    WHEN 'guest@saffronroutes.demo' THEN 25000.00
                    WHEN 'guest2@saffronroutes.demo' THEN 25000.00
                END
                FROM app_user
                JOIN tenant ON tenant.id = app_user.tenant_id
                WHERE wallet.user_id = app_user.id
                  AND tenant.slug IN ('default', 'saffron-routes')
                  AND app_user.email IN ('henry@example.com', 'guest@saffronroutes.demo', 'guest2@saffronroutes.demo')
                """);
    }

    private void resetSimulatedFleetState() {
        jdbcTemplate.update("""
                UPDATE wallet
                SET balance = CASE
                        WHEN rider.id IS NULL THEN 0
                        WHEN tenant.slug = 'default' THEN 5000.00
                        ELSE 500000.00
                    END
                FROM app_user
                JOIN tenant ON tenant.id = app_user.tenant_id
                LEFT JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
                WHERE wallet.user_id = app_user.id
                  AND tenant.slug IN ('default', 'saffron-routes')
                  AND app_user.simulated = TRUE
                """);
        jdbcTemplate.update("""
                UPDATE driver
                SET available = FALSE,
                    current_location = NULL,
                    location_updated_at = NULL,
                    location_heading = NULL,
                    location_speed_kph = NULL
                FROM app_user
                JOIN tenant ON tenant.id = app_user.tenant_id
                WHERE driver.user_id = app_user.id
                  AND driver.tenant_id = tenant.id
                  AND tenant.slug IN ('default', 'saffron-routes')
                  AND app_user.simulated = TRUE
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
                    WHEN 'default' THEN 'carol.driver@example.com'
                    ELSE 'chauffeur2@saffronroutes.demo'
                END AND app_user.tenant_id = tenant.id
                WHERE (tenant.slug = 'default' AND request.external_reference = 'DEMO-VELO-PENDING-01')
                   OR (tenant.slug = 'saffron-routes' AND request.external_reference = 'DEMO-SAFFRON-PENDING-01')
                """);
    }
}
