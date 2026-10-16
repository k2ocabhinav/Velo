package com.velo.platform.configs;

import com.velo.platform.services.TenantBrandingCacheService;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Runs the demo fixture refresher against a freshly migrated schema so the SQL is exercised with the
 * real schema and the local demo seed in place.
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
    private TenantBrandingCacheService tenantBrandingCacheService;

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
        tenantBrandingCacheService = mock(TenantBrandingCacheService.class);
    }

    @AfterEach
    void dropScratchSchema() throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
        }
    }

    @Test
    void run_repairsFixturesAndRemovesNonFixtureDemoSessionData() {
        long veloId = tenantId("default");
        long fixtureRequestId = requestIdByReference("DEMO-VELO-PENDING-01");
        long henryRiderId = riderId("henry@example.com");

        jdbcTemplate.update("UPDATE ride_request SET ride_request_status = 'CONFIRMED' WHERE id = ?", fixtureRequestId);
        long fixtureRideId = rideIdByReference("DEMO-VELO-ONGOING-01");
        jdbcTemplate.update("UPDATE ride SET ride_status = 'ENDED', fare = 150.00, driver_id = ? WHERE id = ?",
                driverId("bob.driver@example.com"), fixtureRideId);

        long sessionRequestId = insertRequest(henryRiderId, veloId, "PENDING", null, null);
        long sessionRideId = insertRide(henryRiderId, driverId("bob.driver@example.com"), veloId,
                "ONGOING", "1357", sessionRequestId, null, new BigDecimal("150.00"));

        long unrelatedUserId = insertUser("ordinary.local@example.com", false, veloId);
        long unrelatedRiderId = insertRider(unrelatedUserId, veloId);
        long unrelatedRequestId = insertRequest(unrelatedRiderId, veloId, "SCHEDULED", null,
                LocalDateTime.of(2026, 11, 3, 14, 30));
        long unrelatedRideId = insertRide(unrelatedRiderId, driverId("bob.driver@example.com"), veloId,
                "CANCELLED", "2468", null, null, new BigDecimal("99.00"));

        runRefresher();

        assertThat(requestStatusOf(fixtureRequestId)).isEqualTo("PENDING");
        assertThat(count("ride", "id", sessionRideId)).isZero();
        assertThat(count("ride_request", "id", sessionRequestId)).isZero();
        assertThat(rideStatusOf(fixtureRideId)).isEqualTo("ONGOING");
        assertThat(riderEmailOfRide(fixtureRideId)).isEqualTo("alice@example.com");
        assertThat(driverEmailOfRide(fixtureRideId)).isEqualTo("carol.driver@example.com");
        assertThat(fareOf("ride_request", "DEMO-SAFFRON-PENDING-01")).isEqualByComparingTo("1453.09");
        assertThat(fareOf("ride", "DEMO-SAFFRON-ENDED-01")).isEqualByComparingTo("1612.17");
        long frankScheduledId = requestIdByReference("DEMO-VELO-SCHEDULED-02");
        assertThat(requestStatusOf(frankScheduledId)).isEqualTo("SCHEDULED");
        assertThat(requestRiderEmailOf(frankScheduledId)).isEqualTo("frank@example.com");
        assertThat(count("ride_request", "id", unrelatedRequestId)).isZero();
        assertThat(count("ride", "id", unrelatedRideId)).isZero();
    }

    @Test
    void run_repairsMutatedDatabaseToTheExactFixtureSet() {
        long veloId = tenantId("default");
        deleteFixtureRide("DEMO-VELO-ONGOING-01", "DEMO-VELO-RIDE-ONGOING-01");
        deleteFixtureRide("DEMO-VELO-ENDED-02", "DEMO-VELO-RIDE-ENDED-02");

        long aliceId = riderId("alice@example.com");
        long staleRequestId = insertRequest(aliceId, veloId, "PENDING", null, null);
        long staleRideId = insertRide(aliceId, driverId("carol.driver@example.com"), veloId,
                "ONGOING", "1357", staleRequestId, null, new BigDecimal("150.00"));
        insertOffer(staleRequestId, driverId("carol.driver@example.com"), veloId);
        insertPayment(userId("alice@example.com"), staleRideId, veloId);
        insertEarning(driverId("carol.driver@example.com"), staleRideId, veloId);
        insertRating(staleRideId, aliceId, driverId("carol.driver@example.com"));
        insertWalletTransaction(staleRideId, walletId("alice@example.com"), veloId);
        insertNotification(userId("alice@example.com"), veloId);
        insertAudit(staleRequestId, staleRideId, veloId);
        insertAudit(requestIdByReference("DEMO-VELO-RIDE-ENDED-01"),
                rideIdByReference("DEMO-VELO-ENDED-01"), veloId);

        runRefresher();

        assertThat(fixtureReferences("ride", "external_reference", "default"))
                .containsExactly(
                        "DEMO-VELO-CANCELLED-01", "DEMO-VELO-ENDED-01", "DEMO-VELO-ENDED-02",
                        "DEMO-VELO-ENDED-03", "DEMO-VELO-ONGOING-01");
        assertThat(fixtureReferences("ride", "external_reference", "saffron-routes"))
                .containsExactly(
                        "DEMO-SAFFRON-ENDED-01", "DEMO-SAFFRON-ENDED-02", "DEMO-SAFFRON-ONGOING-01");
        assertThat(fixtureReferences("ride_request", "external_reference", "default"))
                .containsExactly(
                        "DEMO-VELO-PENDING-01", "DEMO-VELO-RIDE-CANCELLED-01", "DEMO-VELO-RIDE-ENDED-01",
                        "DEMO-VELO-RIDE-ENDED-02", "DEMO-VELO-RIDE-ENDED-03", "DEMO-VELO-RIDE-ONGOING-01",
                        "DEMO-VELO-SCHEDULED-01", "DEMO-VELO-SCHEDULED-02");
        assertThat(fixtureReferences("ride_request", "external_reference", "saffron-routes"))
                .containsExactly(
                        "DEMO-SAFFRON-PENDING-01", "DEMO-SAFFRON-RIDE-ENDED-01", "DEMO-SAFFRON-RIDE-ENDED-02",
                        "DEMO-SAFFRON-RIDE-ONGOING-01", "DEMO-SAFFRON-SCHEDULED-01", "DEMO-SAFFRON-SCHEDULED-02");

        assertThat(count("ride", "id", staleRideId)).isZero();
        assertThat(count("ride_request", "id", staleRequestId)).isZero();
        assertThat(count("ride_offer", "ride_request_id", staleRequestId)).isZero();
        assertThat(count("payment", "ride_id", staleRideId)).isZero();
        assertThat(count("driver_earning", "ride_id", staleRideId)).isZero();
        assertThat(count("rating", "ride_id", staleRideId)).isZero();
        assertThat(count("wallet_transaction", "ride_id", staleRideId)).isZero();
        assertThat(auditCount("default")).isEqualTo(3);
        assertThat(auditCount("saffron-routes")).isEqualTo(3);
        assertThat(riderEmailOfRide(rideIdByReference("DEMO-VELO-ONGOING-01"))).isEqualTo("alice@example.com");
        assertThat(driverEmailOfRide(rideIdByReference("DEMO-VELO-ONGOING-01")))
                .isEqualTo("carol.driver@example.com");
        assertThat(rideStatusOf(rideIdByReference("DEMO-VELO-ONGOING-01"))).isEqualTo("ONGOING");
        assertThat(rideStatusOf(rideIdByReference("DEMO-VELO-ENDED-02"))).isEqualTo("ENDED");
        assertThat(addressForRide("DEMO-VELO-ONGOING-01"))
                .containsExactly("Cubbon Park, Bengaluru", "JP Nagar, Bengaluru");
    }

    @Test
    void run_removesNonFixtureRowsForRealAndSimulatedDemoAccounts() {
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

        assertThat(count("ride", "id", realRideId)).isZero();
        assertThat(count("ride_request", "id", realRequestId)).isZero();
        assertThat(count("ride_offer", "ride_request_id", realRequestId)).isZero();
        assertThat(count("payment", "ride_id", realRideId)).isZero();
        assertThat(count("driver_earning", "ride_id", realRideId)).isZero();
        assertThat(count("rating", "ride_id", realRideId)).isZero();
        assertThat(count("wallet_transaction", "ride_id", realRideId)).isZero();
        assertThat(count("ride", "external_reference", "DEMO-VELO-ENDED-01")).isEqualTo(1);

        assertThat(balanceOf("rider1@sim.velobusiness.demo")).isEqualByComparingTo("5000.00");
        assertThat(balanceOf("guest1@sim.saffronroutes.demo")).isEqualByComparingTo("500000.00");
        assertThat(balanceOf("driver1@sim.velobusiness.demo")).isEqualByComparingTo("0.00");
        assertThat(balanceOf("ordinary.local@example.com")).isEqualByComparingTo("2500.00");

        assertThat(driverState(simDriverId)).isEqualTo("offline");
        assertThat(driverState(simChauffeurId)).isEqualTo("offline");
        assertThat(driverState(realDriverId)).isEqualTo("online");
    }

    @Test
    void run_keepsPresenterAccountsFreeOfOpenFixturesAndOffers() {
        runRefresher();
        runRefresher();

        assertThat(offerCount("DEMO-VELO-PENDING-01")).isEqualTo(1);
        assertThat(offeredDriverEmail("DEMO-VELO-PENDING-01")).isEqualTo("carol.driver@example.com");
        assertThat(offerTtlSeconds("DEMO-VELO-PENDING-01")).isEqualTo(90.0);
        assertThat(fixtureNotificationCount("DEMO-VELO-PENDING-01", "bob.driver@example.com")).isZero();
        assertThat(fixtureNotificationCount("DEMO-VELO-PENDING-01", "carol.driver@example.com")).isEqualTo(1);
        assertThat(offerCount("DEMO-SAFFRON-PENDING-01")).isEqualTo(1);
        assertThat(offeredDriverEmail("DEMO-SAFFRON-PENDING-01")).isEqualTo("chauffeur2@saffronroutes.demo");
        assertThat(offerTtlSeconds("DEMO-SAFFRON-PENDING-01")).isEqualTo(90.0);
        assertThat(fixtureNotificationCount("DEMO-SAFFRON-PENDING-01", "chauffeur1@saffronroutes.demo")).isZero();
        assertThat(fixtureNotificationCount("DEMO-SAFFRON-PENDING-01", "chauffeur2@saffronroutes.demo")).isEqualTo(1);
        assertThat(driverAvailable("bob.driver@example.com")).isFalse();
        assertThat(driverAvailable("chauffeur1@saffronroutes.demo")).isFalse();

        for (String presenterRider : List.of("henry@example.com", "guest@saffronroutes.demo")) {
            assertThat(openFixtureRequestCount(presenterRider)).as("open fixtures for %s", presenterRider).isZero();
            assertThat(activeFixtureRideCountForRider(presenterRider))
                    .as("active fixture rides for %s", presenterRider).isZero();
        }
        for (String presenterDriver : List.of("bob.driver@example.com", "chauffeur1@saffronroutes.demo")) {
            assertThat(activeFixtureRideCountForDriver(presenterDriver))
                    .as("active fixture rides for %s", presenterDriver).isZero();
            assertThat(offeredFixtureCount(presenterDriver))
                    .as("offered fixture rides for %s", presenterDriver).isZero();
        }
        assertThat(requestRiderEmailOf(requestIdByReference("DEMO-SAFFRON-SCHEDULED-01")))
                .isEqualTo("guest2@saffronroutes.demo");
        assertThat(requestRiderEmailOf(requestIdByReference("DEMO-SAFFRON-RIDE-ONGOING-01")))
                .isEqualTo("guest2@saffronroutes.demo");
        assertThat(riderEmailOfRide(rideIdByReference("DEMO-SAFFRON-ONGOING-01")))
                .isEqualTo("guest2@saffronroutes.demo");
        assertThat(riderEmailOfRide(rideIdByReference("DEMO-SAFFRON-ENDED-01")))
                .isEqualTo("guest@saffronroutes.demo");
    }

    @Test
    void run_preservesAddressBearingRequestsForEverySeededRide() {
        runRefresher();

        Long ridesWithAddresses = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM ride
                JOIN ride_request request ON request.id = ride.ride_request_id AND request.tenant_id = ride.tenant_id
                WHERE (ride.external_reference LIKE 'DEMO-VELO-%'
                   OR ride.external_reference LIKE 'DEMO-SAFFRON-%')
                  AND NULLIF(BTRIM(request.pickup_address), '') IS NOT NULL
                  AND NULLIF(BTRIM(request.drop_off_address), '') IS NOT NULL
                """, Long.class);
        assertThat(ridesWithAddresses).isEqualTo(8);
        assertThat(addressForRide("DEMO-VELO-ONGOING-01"))
                .containsExactly("Cubbon Park, Bengaluru", "JP Nagar, Bengaluru");
        assertThat(addressForRide("DEMO-SAFFRON-ONGOING-01"))
                .containsExactly("JP Nagar, Bengaluru", "Kempegowda International Airport, Terminal 1");
    }

    @Test
    void seed_containsThreeOperatorAuditRowsForEachDemoTenant() {
        assertThat(auditCount("default")).isEqualTo(3);
        assertThat(auditCount("saffron-routes")).isEqualTo(3);

        runRefresher();

        assertThat(auditCount("default")).isEqualTo(3);
        assertThat(auditCount("saffron-routes")).isEqualTo(3);
    }

    @Test
    void run_invalidatesOnlyDemoTenantBrandingCacheEntries() {
        runRefresher();

        verify(tenantBrandingCacheService).evict("default");
        verify(tenantBrandingCacheService).evict("saffron-routes");
    }

    private void runRefresher() {
        new DemoFixtureTimestampRefresher(jdbcTemplate, tenantBrandingCacheService).run(null);
    }

    private void deleteFixtureRide(String rideReference, String requestReference) {
        jdbcTemplate.update("""
                DELETE FROM admin_dispatch_audit
                WHERE ride_id IN (SELECT id FROM ride WHERE external_reference = ?)
                   OR ride_request_id IN (SELECT id FROM ride_request WHERE external_reference = ?)
                """, rideReference, requestReference);
        jdbcTemplate.update("DELETE FROM payment WHERE ride_id IN (SELECT id FROM ride WHERE external_reference = ?)",
                rideReference);
        jdbcTemplate.update("DELETE FROM driver_earning WHERE ride_id IN (SELECT id FROM ride WHERE external_reference = ?)",
                rideReference);
        jdbcTemplate.update("DELETE FROM rating WHERE ride_id IN (SELECT id FROM ride WHERE external_reference = ?)",
                rideReference);
        jdbcTemplate.update("DELETE FROM wallet_transaction WHERE ride_id IN (SELECT id FROM ride WHERE external_reference = ?)",
                rideReference);
        jdbcTemplate.update("DELETE FROM ride WHERE external_reference = ?", rideReference);
        jdbcTemplate.update("DELETE FROM ride_request WHERE external_reference = ?", requestReference);
    }

    private List<String> fixtureReferences(String table, String column, String tenantSlug) {
        return jdbcTemplate.queryForList("""
                SELECT %s FROM %s
                JOIN tenant ON tenant.id = %s.tenant_id
                WHERE tenant.slug = ?
                ORDER BY %s
                """.formatted(column, table, table, column), String.class, tenantSlug);
    }

    private void insertAudit(long requestId, long rideId, long tenantId) {
        jdbcTemplate.update("""
                INSERT INTO admin_dispatch_audit (
                    action_type, actor_user_id, ride_request_id, ride_id, previous_driver_id, next_driver_id,
                    reason, created_at, tenant_id
                ) VALUES ('REASSIGN_RIDE', ?, ?, ?, ?, ?, 'Test stale demo ride', NOW(), ?)
                """, userId("admin@velo-platform.com"), requestId, rideId,
                driverId("bob.driver@example.com"), driverId("carol.driver@example.com"), tenantId);
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

    private long rideIdByReference(String externalReference) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM ride WHERE external_reference = ?", Long.class, externalReference);
    }

    private BigDecimal fareOf(String table, String externalReference) {
        return jdbcTemplate.queryForObject(
                "SELECT fare FROM " + table + " WHERE external_reference = ?", BigDecimal.class, externalReference);
    }

    private long offerCount(String requestReference) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM ride_offer offer
                JOIN ride_request request ON request.id = offer.ride_request_id
                WHERE request.external_reference = ? AND offer.status = 'OFFERED'
                """, Long.class, requestReference);
    }

    private long openFixtureRequestCount(String email) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM ride_request request
                JOIN rider ON rider.id = request.rider_id
                JOIN app_user ON app_user.id = rider.user_id
                WHERE app_user.email = ?
                  AND request.external_reference LIKE 'DEMO-%'
                  AND request.ride_request_status IN ('PENDING', 'CONFIRMED', 'ONGOING', 'SCHEDULED')
                """, Long.class, email);
    }

    private long activeFixtureRideCountForRider(String email) {
        return activeFixtureRideCount("rider", email);
    }

    private long activeFixtureRideCountForDriver(String email) {
        return activeFixtureRideCount("driver", email);
    }

    private long activeFixtureRideCount(String roleTable, String email) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM ride
                JOIN %s ON %s.id = ride.%s_id
                JOIN app_user ON app_user.id = %s.user_id
                WHERE app_user.email = ?
                  AND ride.external_reference LIKE 'DEMO-%%'
                  AND ride.ride_status IN ('CONFIRMED', 'ONGOING')
                """.formatted(roleTable, roleTable, roleTable, roleTable), Long.class, email);
    }

    private long offeredFixtureCount(String email) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM ride_offer offer
                JOIN ride_request request ON request.id = offer.ride_request_id
                JOIN driver ON driver.id = offer.driver_id
                JOIN app_user ON app_user.id = driver.user_id
                WHERE app_user.email = ?
                  AND request.external_reference LIKE 'DEMO-%'
                  AND offer.status = 'OFFERED'
                """, Long.class, email);
    }

    private String offeredDriverEmail(String requestReference) {
        return jdbcTemplate.queryForObject("""
                SELECT app_user.email FROM ride_offer offer
                JOIN ride_request request ON request.id = offer.ride_request_id
                JOIN driver ON driver.id = offer.driver_id
                JOIN app_user ON app_user.id = driver.user_id
                WHERE request.external_reference = ? AND offer.status = 'OFFERED'
                """, String.class, requestReference);
    }

    private Double offerTtlSeconds(String requestReference) {
        return jdbcTemplate.queryForObject("""
                SELECT EXTRACT(EPOCH FROM (offer.expires_at - offer.offered_at))
                FROM ride_offer offer
                JOIN ride_request request ON request.id = offer.ride_request_id
                WHERE request.external_reference = ? AND offer.status = 'OFFERED'
                """, Double.class, requestReference);
    }

    private long fixtureNotificationCount(String requestReference, String email) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM notification
                WHERE reference_id = (SELECT id FROM ride_request WHERE external_reference = ?)
                  AND user_id = (SELECT id FROM app_user WHERE email = ?)
                """, Long.class, requestReference, email);
    }

    private List<String> addressForRide(String rideReference) {
        return jdbcTemplate.queryForObject("""
                SELECT request.pickup_address, request.drop_off_address
                FROM ride
                JOIN ride_request request ON request.id = ride.ride_request_id
                WHERE ride.external_reference = ?
                """, (resultSet, rowNumber) -> List.of(
                resultSet.getString(1), resultSet.getString(2)), rideReference);
    }

    private long auditCount(String tenantSlug) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM admin_dispatch_audit audit
                JOIN tenant ON tenant.id = audit.tenant_id
                WHERE tenant.slug = ? AND audit.action_type IN ('ASSIGN_REQUEST', 'REASSIGN_RIDE')
                """, Long.class, tenantSlug);
    }

    private String requestRiderEmailOf(long requestId) {
        return jdbcTemplate.queryForObject("""
                SELECT app_user.email FROM ride_request request
                JOIN rider ON rider.id = request.rider_id
                JOIN app_user ON app_user.id = rider.user_id
                WHERE request.id = ?
                """, String.class, requestId);
    }

    private String riderEmailOfRide(long rideId) {
        return jdbcTemplate.queryForObject("""
                SELECT app_user.email FROM ride
                JOIN rider ON rider.id = ride.rider_id
                JOIN app_user ON app_user.id = rider.user_id
                WHERE ride.id = ?
                """, String.class, rideId);
    }

    private String driverEmailOfRide(long rideId) {
        return jdbcTemplate.queryForObject("""
                SELECT app_user.email FROM ride
                JOIN driver ON driver.id = ride.driver_id
                JOIN app_user ON app_user.id = driver.user_id
                WHERE ride.id = ?
                """, String.class, rideId);
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

    private boolean driverAvailable(String email) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT driver.available
                FROM driver
                JOIN app_user ON app_user.id = driver.user_id
                WHERE app_user.email = ?
                """, Boolean.class, email));
    }
}
