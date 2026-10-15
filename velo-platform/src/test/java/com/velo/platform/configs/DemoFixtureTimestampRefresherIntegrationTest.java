package com.velo.platform.configs;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the demo fixture refresher against a freshly migrated schema so the SQL is exercised with the
 * real V13 columns and the local demo seed in place.
 */
class DemoFixtureTimestampRefresherIntegrationTest {

    private static final String JDBC_URL = System.getProperty(
            "velo.test.flyway.url",
            "jdbc:postgresql://localhost:5432/testpostgres_flyway");
    private static final String JDBC_USERNAME = System.getProperty(
            "velo.test.flyway.username", System.getProperty("spring.datasource.username", "postgres"));
    private static final String JDBC_PASSWORD = System.getProperty(
            "velo.test.flyway.password", System.getProperty("spring.datasource.password", "user"));

    private String schemaName;
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void migrateScratchSchema() throws Exception {
        schemaName = "refresher_it_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE EXTENSION IF NOT EXISTS postgis");
            statement.execute("CREATE SCHEMA " + schemaName);
        }
        Flyway.configure()
                .dataSource(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD)
                .defaultSchema(schemaName)
                .schemas(schemaName)
                .locations("classpath:db/migration", "classpath:db/demo-migration")
                .baselineOnMigrate(true)
                .load()
                .migrate();
        var dataSource = new DriverManagerDataSource(
                JDBC_URL + "?currentSchema=" + schemaName + ",public", JDBC_USERNAME, JDBC_PASSWORD);
        jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @AfterEach
    void dropScratchSchema() throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
        }
    }

    @Test
    void run_resetsOnlyTheNamedDemoFixturesAndLeavesUnrelatedRowsUntouched() {
        long veloId = tenantId("default");
        long fixtureRequestId = requestIdByReference("DEMO-VELO-PENDING-01");
        long henryRiderId = riderId("henry@example.com");

        jdbcTemplate.update("UPDATE ride_request SET ride_request_status = 'CONFIRMED' WHERE id = ?", fixtureRequestId);
        long fixtureRideId = insertRide(riderId("alice@example.com"), driverId("carol.driver@example.com"), veloId,
                "ENDED", "2468", null, "DEMO-VELO-ONGOING-01", new BigDecimal("150.00"));

        long sessionRequestId = insertRequest(henryRiderId, veloId, "PENDING", null, null);
        long sessionRideId = insertRide(henryRiderId, driverId("bob.driver@example.com"), veloId,
                "ONGOING", "1357", sessionRequestId, null, new BigDecimal("150.00"));

        long unrelatedUserId = insertUser("ordinary.local@example.com", false, veloId);
        long unrelatedRiderId = insertRider(unrelatedUserId, veloId);
        LocalDateTime unrelatedScheduledAt = LocalDateTime.of(2026, 11, 3, 14, 30);
        long unrelatedRequestId = insertRequest(unrelatedRiderId, veloId, "SCHEDULED", null, unrelatedScheduledAt);
        long unrelatedRideId = insertRide(unrelatedRiderId, driverId("bob.driver@example.com"), veloId,
                "CANCELLED", "2468", null, null, new BigDecimal("99.00"));

        runRefresher();

        assertThat(requestStatusOf(fixtureRequestId)).isEqualTo("PENDING");
        assertThat(count("ride", "id", sessionRideId)).isZero();
        assertThat(count("ride_request", "id", sessionRequestId)).isZero();
        assertThat(rideStatusOf(fixtureRideId)).isEqualTo("ONGOING");
        assertThat(requestStatusOf(unrelatedRequestId)).isEqualTo("SCHEDULED");
        assertThat(scheduledTimeOf(unrelatedRequestId)).isEqualTo(unrelatedScheduledAt);
        assertThat(rideStatusOf(unrelatedRideId)).isEqualTo("CANCELLED");
        assertThat(fareOf(unrelatedRideId)).isEqualByComparingTo("99.00");
    }

    @Test
    void run_removesOnlyTheSimulatedFleetOfTheDemoTenantsAndLeavesRealRowsUntouched() {
        long veloId = tenantId("default");
        long saffronId = tenantId("saffron-routes");

        long simRiderId = riderId("rider1@sim.velobusiness.demo");
        long simDriverId = driverId("driver1@sim.velobusiness.demo");
        long simGuestId = riderId("guest1@sim.saffronroutes.demo");
        long simChauffeurId = driverId("chauffeur1@sim.saffronroutes.demo");

        long realRiderUserId = insertUser("ordinary.local@example.com", false, veloId);
        long realRiderId = insertRider(realRiderUserId, veloId);
        long realDriverId = insertDriver("ordinary.driver@example.com", false, veloId);
        insertWallet(realRiderUserId, new BigDecimal("2500.00"), veloId);

        setBalance("rider1@sim.velobusiness.demo", new BigDecimal("0.00"));
        setBalance("guest1@sim.saffronroutes.demo", new BigDecimal("0.00"));
        setBalance("driver1@sim.velobusiness.demo", new BigDecimal("120.00"));
        placeDriver(simDriverId, 77.6020, 12.9750);
        placeDriver(simChauffeurId, 77.6060, 12.9660);
        placeDriver(realDriverId, 77.5946, 12.9716);

        long simRequestId = insertRequest(simRiderId, veloId, "PENDING", null, null);
        long simRideId = insertRide(simRiderId, simDriverId, veloId, "ENDED", "1111", null, null,
                new BigDecimal("180.00"));
        insertOffer(simRequestId, simDriverId, veloId);
        insertPayment(userId("rider1@sim.velobusiness.demo"), simRideId, veloId);
        insertEarning(simDriverId, simRideId, veloId);
        insertRating(simRideId, simRiderId, simDriverId);
        insertWalletTransaction(simRideId, walletId("rider1@sim.velobusiness.demo"), veloId);
        insertNotification(userId("rider1@sim.velobusiness.demo"), veloId);

        long simGuestRequestId = insertRequest(simGuestId, saffronId, "PENDING", null, null);
        long simGuestRideId = insertRide(simGuestId, simChauffeurId, saffronId, "ENDED", "1111", null, null,
                new BigDecimal("900.00"));

        long realRequestId = insertRequest(realRiderId, veloId, "PENDING", null, null);
        long realRideId = insertRide(realRiderId, realDriverId, veloId, "ENDED", "2222", null, null,
                new BigDecimal("180.00"));
        insertOffer(realRequestId, realDriverId, veloId);
        insertPayment(userId("ordinary.local@example.com"), realRideId, veloId);
        insertEarning(realDriverId, realRideId, veloId);
        insertRating(realRideId, realRiderId, realDriverId);
        insertWalletTransaction(realRideId, walletId("ordinary.local@example.com"), veloId);
        insertNotification(userId("ordinary.local@example.com"), veloId);

        runRefresher();

        assertThat(count("ride", "id", simRideId)).isZero();
        assertThat(count("ride_request", "id", simRequestId)).isZero();
        assertThat(count("ride_offer", "ride_request_id", simRequestId)).isZero();
        assertThat(count("payment", "ride_id", simRideId)).isZero();
        assertThat(count("driver_earning", "ride_id", simRideId)).isZero();
        assertThat(count("rating", "ride_id", simRideId)).isZero();
        assertThat(count("wallet_transaction", "ride_id", simRideId)).isZero();
        assertThat(count("notification", "user_id", userId("rider1@sim.velobusiness.demo"))).isZero();
        assertThat(count("ride", "id", simGuestRideId)).isZero();
        assertThat(count("ride_request", "id", simGuestRequestId)).isZero();

        assertThat(count("ride", "id", realRideId)).isEqualTo(1);
        assertThat(count("ride_request", "id", realRequestId)).isEqualTo(1);
        assertThat(count("ride_offer", "ride_request_id", realRequestId)).isEqualTo(1);
        assertThat(count("payment", "ride_id", realRideId)).isEqualTo(1);
        assertThat(count("driver_earning", "ride_id", realRideId)).isEqualTo(1);
        assertThat(count("rating", "ride_id", realRideId)).isEqualTo(1);
        assertThat(count("wallet_transaction", "ride_id", realRideId)).isEqualTo(1);
        assertThat(count("ride", "external_reference", "DEMO-VELO-ENDED-01")).isEqualTo(1);

        assertThat(balanceOf("rider1@sim.velobusiness.demo")).isEqualByComparingTo("5000.00");
        assertThat(balanceOf("guest1@sim.saffronroutes.demo")).isEqualByComparingTo("500000.00");
        assertThat(balanceOf("driver1@sim.velobusiness.demo")).isEqualByComparingTo("0.00");
        assertThat(balanceOf("ordinary.local@example.com")).isEqualByComparingTo("2500.00");

        assertThat(driverState(simDriverId)).isEqualTo("offline");
        assertThat(driverState(simChauffeurId)).isEqualTo("offline");
        assertThat(driverState(realDriverId)).isEqualTo("online");
    }

    private void runRefresher() {
        new DemoFixtureTimestampRefresher(jdbcTemplate).run(null);
    }

    private long tenantId(String slug) {
        return jdbcTemplate.queryForObject("SELECT id FROM tenant WHERE slug = ?", Long.class, slug);
    }

    private long userId(String email) {
        return jdbcTemplate.queryForObject("SELECT id FROM app_user WHERE email = ?", Long.class, email);
    }

    private long riderId(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM rider WHERE user_id = (SELECT id FROM app_user WHERE email = ?)", Long.class, email);
    }

    private long driverId(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM driver WHERE user_id = (SELECT id FROM app_user WHERE email = ?)", Long.class, email);
    }

    private long walletId(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM wallet WHERE user_id = (SELECT id FROM app_user WHERE email = ?)", Long.class, email);
    }

    private long requestIdByReference(String externalReference) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM ride_request WHERE external_reference = ?", Long.class, externalReference);
    }

    private long insertUser(String email, boolean simulated, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO app_user (
                    first_name, last_name, email, password, phone_number, active, created_time, version,
                    tenant_id, simulated
                ) VALUES ('Test', 'Account', ?, 'encoded', '+1-555-0100', TRUE, NOW(), 0, ?, ?)
                """, email, tenantId, simulated);
        return userId(email);
    }

    private long insertRider(long userId, long tenantId) {
        jdbcTemplate.update("INSERT INTO rider (user_id, rating, version, tenant_id) VALUES (?, 4.5, 0, ?)",
                userId, tenantId);
        return jdbcTemplate.queryForObject("SELECT id FROM rider WHERE user_id = ?", Long.class, userId);
    }

    private long insertDriver(String email, boolean simulated, long tenantId) {
        long userId = insertUser(email, simulated, tenantId);
        jdbcTemplate.update("""
                INSERT INTO driver (user_id, vehicle_id, rating, available, onboarding_status, created_at, version, tenant_id)
                VALUES (?, ?, 4.8, FALSE, 'APPROVED', NOW(), 0, ?)
                """, userId, "TEST-" + userId, tenantId);
        return jdbcTemplate.queryForObject("SELECT id FROM driver WHERE user_id = ?", Long.class, userId);
    }

    private void insertWallet(long userId, BigDecimal balance, long tenantId) {
        jdbcTemplate.update("INSERT INTO wallet (user_id, balance, version, tenant_id) VALUES (?, ?, 0, ?)",
                userId, balance, tenantId);
    }

    private long insertRequest(long riderId, long tenantId, String status, String externalReference,
                               LocalDateTime scheduledTime) {
        jdbcTemplate.update("""
                INSERT INTO ride_request (
                    pickup_location, drop_off_location, requested_time, scheduled_time, rider_id, payment_method,
                    ride_request_status, fare, external_reference, version, tenant_id
                ) VALUES (
                    ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
                    ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326),
                    NOW(), ?, ?, 'CASH', ?, 100.00, ?, 0, ?
                )
                """, scheduledTime, riderId, status, externalReference, tenantId);
        return jdbcTemplate.queryForObject("""
                SELECT id FROM ride_request
                WHERE rider_id = ? AND tenant_id = ?
                ORDER BY id DESC LIMIT 1
                """, Long.class, riderId, tenantId);
    }

    private long insertRide(long riderId, long driverId, long tenantId, String status, String otp,
                            Long rideRequestId, String externalReference, BigDecimal fare) {
        jdbcTemplate.update("""
                INSERT INTO ride (
                    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
                    payment_method, ride_status, fare, otp, ride_request_id, external_reference, version, tenant_id
                ) VALUES (
                    ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
                    ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326),
                    NOW(), NOW(), NOW(), ?, ?, 'CASH', ?, ?, ?, ?, ?, 0, ?
                )
                """, riderId, driverId, status, fare, otp, rideRequestId, externalReference, tenantId);
        return jdbcTemplate.queryForObject("""
                SELECT id FROM ride
                WHERE rider_id = ? AND driver_id = ? AND otp = ?
                ORDER BY id DESC LIMIT 1
                """, Long.class, riderId, driverId, otp);
    }

    private void insertOffer(long requestId, long driverId, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO ride_offer (
                    ride_request_id, driver_id, status, offered_at, expires_at, version, tenant_id
                ) VALUES (?, ?, 'OFFERED', NOW(), NOW() + INTERVAL '1 minute', 0, ?)
                """, requestId, driverId, tenantId);
    }

    private void insertPayment(long userId, long rideId, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO payment (
                    payment_method, user_id, ride_id, amount, payment_status, payment_time, version, tenant_id
                ) VALUES ('CASH', ?, ?, 180.00, 'CONFIRMED', NOW(), 0, ?)
                """, userId, rideId, tenantId);
    }

    private void insertEarning(long driverId, long rideId, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO driver_earning (
                    driver_id, ride_id, gross_fare, platform_commission, net_earning, created_time, version, tenant_id
                ) VALUES (?, ?, 180.00, 54.00, 126.00, NOW(), 0, ?)
                """, driverId, rideId, tenantId);
    }

    private void insertRating(long rideId, long riderId, long driverId) {
        jdbcTemplate.update("""
                INSERT INTO rating (ride_id, rider_id, driver_id, driver_rating, rider_rating, version)
                VALUES (?, ?, ?, 5, 5, 0)
                """, rideId, riderId, driverId);
    }

    private void insertWalletTransaction(long rideId, long walletId, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO wallet_transaction (
                    amount, transaction_type, transaction_method, transaction_id, ride_id, wallet_id,
                    "timestamp", version, tenant_id
                ) VALUES (180.00, 1, 1, ?, ?, ?, NOW(), 0, ?)
                """, "TEST-RIDE-" + rideId, rideId, walletId, tenantId);
    }

    private void insertNotification(long userId, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO notification (
                    user_id, title, message, type, reference_id, read, created_time, version, tenant_id
                ) VALUES (?, 'Test', 'Test notification', 'RIDE_REQUESTED', NULL, FALSE, NOW(), 0, ?)
                """, userId, tenantId);
    }

    private void placeDriver(long driverId, double longitude, double latitude) {
        jdbcTemplate.update("""
                UPDATE driver
                SET available = TRUE,
                    current_location = ST_SetSRID(ST_MakePoint(?, ?), 4326),
                    location_updated_at = NOW(),
                    location_heading = 85.0,
                    location_speed_kph = 32.5
                WHERE id = ?
                """, longitude, latitude, driverId);
    }

    private void setBalance(String email, BigDecimal balance) {
        jdbcTemplate.update("UPDATE wallet SET balance = ? WHERE user_id = (SELECT id FROM app_user WHERE email = ?)",
                balance, email);
    }

    private BigDecimal balanceOf(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT balance FROM wallet WHERE user_id = (SELECT id FROM app_user WHERE email = ?)",
                BigDecimal.class, email);
    }

    private String requestStatusOf(long requestId) {
        return jdbcTemplate.queryForObject(
                "SELECT ride_request_status FROM ride_request WHERE id = ?", String.class, requestId);
    }

    private String rideStatusOf(long rideId) {
        return jdbcTemplate.queryForObject("SELECT ride_status FROM ride WHERE id = ?", String.class, rideId);
    }

    private LocalDateTime scheduledTimeOf(long requestId) {
        return jdbcTemplate.queryForObject(
                "SELECT scheduled_time FROM ride_request WHERE id = ?", LocalDateTime.class, requestId);
    }

    private BigDecimal fareOf(long rideId) {
        return jdbcTemplate.queryForObject("SELECT fare FROM ride WHERE id = ?", BigDecimal.class, rideId);
    }

    private long count(String table, String column, Object value) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?", Long.class, value);
        return count == null ? 0 : count;
    }

    private String driverState(long driverId) {
        return jdbcTemplate.queryForObject("""
                SELECT CASE
                        WHEN available = FALSE
                         AND current_location IS NULL
                         AND location_updated_at IS NULL
                         AND location_heading IS NULL
                         AND location_speed_kph IS NULL
                        THEN 'offline' ELSE 'online'
                    END
                FROM driver
                WHERE id = ?
                """, String.class, driverId);
    }
}
