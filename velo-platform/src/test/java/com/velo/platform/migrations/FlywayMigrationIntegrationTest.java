package com.velo.platform.migrations;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

class FlywayMigrationIntegrationTest {

    private static final String JDBC_URL = System.getProperty(
            "velo.test.flyway.url",
            "jdbc:postgresql://localhost:5432/testpostgres_flyway");
    private static final String JDBC_USERNAME = System.getProperty(
            "velo.test.flyway.username", System.getProperty("spring.datasource.username", "postgres"));
    private static final String JDBC_PASSWORD = System.getProperty(
            "velo.test.flyway.password", System.getProperty("spring.datasource.password", "user"));

    private String schemaName;
    private boolean canClean = false;

    @BeforeEach
    void setUp() throws Exception {
        schemaName = "flyway_it_" + UUID.randomUUID().toString().replace("-", "");
        ensurePostgisExtension();
        canClean = true;
    }

    @AfterEach
    void tearDown() {
        if (!canClean) {
            return;
        }
        Flyway flyway = newFlyway(schemaName);
        flyway.clean();
    }

    @Test
    @DisplayName("Flyway migrate should build baseline schema and keep seeded counts stable across repeat migrate")
    void migrateTwice_shouldKeepSeedCountsStable() throws Exception {
        Flyway flyway = newFlyway(schemaName);
        flyway.clean();
        flyway.migrate();

        long usersAfterFirst = count(schemaName, "app_user");
        long driversAfterFirst = count(schemaName, "driver");
        long ridersAfterFirst = count(schemaName, "rider");
        long requestsAfterFirst = count(schemaName, "ride_request");
        long offersAfterFirst = count(schemaName, "ride_offer");
        long auditsAfterFirst = count(schemaName, "admin_dispatch_audit");
        long historyAfterFirst = count(schemaName, "flyway_schema_history");

        assertThat(usersAfterFirst).isGreaterThan(0);
        assertThat(driversAfterFirst).isGreaterThan(0);
        assertThat(ridersAfterFirst).isGreaterThan(0);
        assertThat(requestsAfterFirst).isGreaterThan(0);
        assertThat(offersAfterFirst).isGreaterThan(0);
        assertThat(auditsAfterFirst).isGreaterThan(0);
        assertThat(historyAfterFirst).isGreaterThanOrEqualTo(2);

        flyway.migrate();

        assertThat(count(schemaName, "app_user")).isEqualTo(usersAfterFirst);
        assertThat(count(schemaName, "driver")).isEqualTo(driversAfterFirst);
        assertThat(count(schemaName, "rider")).isEqualTo(ridersAfterFirst);
        assertThat(count(schemaName, "ride_request")).isEqualTo(requestsAfterFirst);
        assertThat(count(schemaName, "ride_offer")).isEqualTo(offersAfterFirst);
        assertThat(count(schemaName, "admin_dispatch_audit")).isEqualTo(auditsAfterFirst);
        assertThat(count(schemaName, "flyway_schema_history")).isEqualTo(historyAfterFirst);
    }

    @Test
    @DisplayName("Flyway clean+migrate cycles should reproduce the same seeded baseline")
    void cleanAndMigrateTwice_shouldBeDeterministic() throws Exception {
        Flyway flyway = newFlyway(schemaName);
        flyway.clean();
        flyway.migrate();

        long usersAfterFirst = count(schemaName, "app_user");
        long ridesAfterFirst = count(schemaName, "ride");
        long offersAfterFirst = count(schemaName, "ride_offer");

        flyway.clean();
        flyway.migrate();

        assertThat(count(schemaName, "app_user")).isEqualTo(usersAfterFirst);
        assertThat(count(schemaName, "ride")).isEqualTo(ridesAfterFirst);
        assertThat(count(schemaName, "ride_offer")).isEqualTo(offersAfterFirst);
    }

    @Test
    @DisplayName("Local demo migration seeds repeatable, tenant-scoped fleets and trip history")
    void demoLocation_shouldSeedBothTenantsAndRemainRepeatable() throws Exception {
        Flyway flyway = newFlyway(schemaName);
        flyway.clean();
        flyway.migrate();

        assertThat(count(schemaName, "tenant")).isEqualTo(2);
        assertTenantServiceArea("default", 12.9716, 77.5946, 60.0);
        assertTenantServiceArea("saffron-routes", 12.9716, 77.5946, 60.0);
        assertThat(countByTenantSlug("app_user", "default")).isGreaterThanOrEqualTo(5);
        assertThat(countByTenantSlug("app_user", "saffron-routes")).isEqualTo(21);
        assertThat(countByTenantSlug("driver", "default")).isGreaterThanOrEqualTo(2);
        assertThat(countByTenantSlug("driver", "saffron-routes")).isEqualTo(8);
        assertThat(countSimulatedAccounts("default")).isEqualTo(16);
        assertThat(countSimulatedAccounts("saffron-routes")).isEqualTo(16);
        assertThat(countByTenantSlug("ride", "default")).isGreaterThanOrEqualTo(5);
        assertThat(countByTenantSlug("ride", "saffron-routes")).isGreaterThanOrEqualTo(3);
        assertThat(countRideByOtpStatus("1357", "ENDED")).isEqualTo(1);
        assertThat(countRideByOtpStatus("1357", "CONFIRMED")).isZero();
        assertThat(countPaymentByRideOtpStatus("4826", "PENDING")).isEqualTo(1);
        assertThat(countByTenantSlug("payout_request", "default")).isGreaterThanOrEqualTo(2);
        assertThat(countByTenantSlug("payout_request", "saffron-routes")).isEqualTo(2);
        assertThat(countBranding("saffron-routes", "Saffron Routes", "#8A3D2B", "Guest", "Chauffeur", "Transfer", "INR")).isEqualTo(1);
        assertThat(countBranding("default", "Velo Business", "#1A56FF", "Rider", "Driver", "Trip", "USD")).isEqualTo(1);
        assertTenantTariff("default", "5.00", "2.00", "0.00");
        assertTenantTariff("saffron-routes", "250.00", "35.00", "600.00");
        assertThat(countAuditReason("Assigned nearest available driver")).isZero();
        assertThat(countAuditReason("Initial seeded assignment history entry.")).isZero();

        assertThat(countRideFixture("DEMO-VELO-ONGOING-01", "alice@example.com", "carol.driver@example.com", "ONGOING"))
                .isEqualTo(1);
        assertThat(countRidesByStatus("default", "ONGOING")).isEqualTo(1);
        assertThat(countRequestFixture("DEMO-VELO-SCHEDULED-01", "alice@example.com", "SCHEDULED")).isEqualTo(1);
        assertThat(countRequestFixture("DEMO-VELO-SCHEDULED-02", "frank@example.com", "SCHEDULED")).isEqualTo(1);
        assertThat(countRequestFixture("DEMO-VELO-SCHEDULED-02", "henry@example.com", "SCHEDULED")).isZero();
        assertSeededFaresFollowPricingFormula(schemaName);
        assertSaffronEarningsPayoutAndWalletUseTariff();
        assertThat(countSeededRatingRows(schemaName)).isEqualTo(5);

        long usersAfterFirst = count(schemaName, "app_user");
        long ridesAfterFirst = count(schemaName, "ride");
        long requestsAfterFirst = count(schemaName, "ride_request");
        long payoutsAfterFirst = count(schemaName, "payout_request");

        flyway.migrate();

        assertThat(count(schemaName, "tenant")).isEqualTo(2);
        assertThat(count(schemaName, "app_user")).isEqualTo(usersAfterFirst);
        assertThat(count(schemaName, "ride")).isEqualTo(ridesAfterFirst);
        assertThat(count(schemaName, "ride_request")).isEqualTo(requestsAfterFirst);
        assertThat(count(schemaName, "payout_request")).isEqualTo(payoutsAfterFirst);
        assertThat(countAuditReason("Assigned nearest available driver")).isZero();
        assertThat(countAuditReason("Initial seeded assignment history entry.")).isZero();
        assertThat(countRideFixture("DEMO-VELO-ONGOING-01", "alice@example.com", "carol.driver@example.com", "ONGOING"))
                .isEqualTo(1);
        assertThat(countRequestFixture("DEMO-VELO-SCHEDULED-02", "frank@example.com", "SCHEDULED")).isEqualTo(1);
        assertSeededFaresFollowPricingFormula(schemaName);
        assertSaffronEarningsPayoutAndWalletUseTariff();
        assertThat(countSeededRatingRows(schemaName)).isEqualTo(5);
    }

    @Test
    @DisplayName("Repeatable demo seed restores realistic Velo Business names on existing rows, idempotently")
    void repeatableSeed_shouldRenameExistingRowsIdempotently() throws Exception {
        Flyway flyway = newFlyway(schemaName);
        flyway.clean();
        flyway.migrate();

        assertVeloBusinessDisplayNames();

        updateUserDisplayName("alice@example.com", "Alice", "Rider");
        updateUserDisplayName("henry@example.com", "Henry", "Rider");
        rerunTenantSeed(flyway);
        assertVeloBusinessDisplayNames();

        rerunTenantSeed(flyway);
        assertVeloBusinessDisplayNames();
    }

    @Test
    @DisplayName("Production Flyway location excludes the demo seed")
    void productionLocation_ShouldExcludeDemoSeed() throws Exception {
        Flyway productionFlyway = newFlyway("classpath:db/migration", schemaName);
        productionFlyway.clean();
        productionFlyway.migrate();

        assertThat(count(schemaName, "app_user")).isZero();
        assertThat(count(schemaName, "tenant")).isEqualTo(1);
        assertThat(countTenantSlug("saffron-routes")).isZero();
        assertTenantTariff("default", "5.00", "2.00", "0.00");
    }

    @Test
    @DisplayName("V16 converts only pre-V15 scheduled requests that are still waiting for dispatch")
    void v16_shouldConvertPreV15ScheduledInstantsOnly() throws Exception {
        Flyway throughV14 = newFlyway("classpath:db/migration", schemaName, "14");
        throughV14.clean();
        throughV14.migrate();

        long saffronTenantId;
        long saffronRiderId;
        long defaultRiderId;
        long recurringTemplateId;
        LocalDateTime createdBeforeV15 = now().minusDays(1);
        LocalDateTime manualWallTime = now().plusDays(4)
                .withHour(9).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime recurringWallTime = manualWallTime.plusDays(1);
        LocalDateTime pastWallTime = now().minusDays(1);
        LocalDateTime pastInTenantWallTime = now().plusHours(2);
        LocalDateTime utcWallTime = manualWallTime.plusDays(2);

        try (Connection connection = connection(); Statement schema = connection.createStatement()) {
            schema.execute("SET search_path TO " + schemaName + ", public");
            saffronTenantId = insertTenant(connection, "saffron-routes");
            saffronRiderId = insertRider(connection, saffronTenantId, "legacy-saffron@example.test");
            defaultRiderId = insertRider(connection, 1L, "legacy-default@example.test");
            recurringTemplateId = insertRecurringTemplate(connection, saffronTenantId, saffronRiderId, createdBeforeV15);
            insertScheduledRequest(connection, saffronTenantId, saffronRiderId, "legacy-manual", manualWallTime, createdBeforeV15, null, null);
            insertScheduledRequest(connection, saffronTenantId, saffronRiderId, "legacy-recurring", recurringWallTime, createdBeforeV15,
                    recurringTemplateId, recurringWallTime.toLocalDate());
            insertScheduledRequest(connection, saffronTenantId, saffronRiderId, "legacy-past", pastWallTime, createdBeforeV15, null, null);
            insertScheduledRequest(connection, saffronTenantId, saffronRiderId, "legacy-local-past", pastInTenantWallTime,
                    createdBeforeV15, null, null);
            insertScheduledRequest(connection, 1L, defaultRiderId, "legacy-utc", utcWallTime, createdBeforeV15, null, null);
        }

        newFlyway("classpath:db/migration", schemaName, "15").migrate();

        LocalDateTime createdAfterV15 = now().plusDays(1);
        LocalDateTime newWallTime = now().plusDays(5)
                .withHour(9).withMinute(0).withSecond(0).withNano(0);
        try (Connection connection = connection(); Statement schema = connection.createStatement()) {
            schema.execute("SET search_path TO " + schemaName + ", public");
            insertScheduledRequest(connection, saffronTenantId, saffronRiderId, "new-saffron", newWallTime, createdAfterV15, null, null);
        }

        Flyway latest = newFlyway("classpath:db/migration", schemaName);
        latest.migrate();

        assertScheduledTime("legacy-manual", inUtc(manualWallTime, "Asia/Kolkata"));
        assertScheduledTime("legacy-recurring", inUtc(recurringWallTime, "Asia/Kolkata"));
        assertScheduledTime("legacy-past", pastWallTime);
        assertScheduledTime("legacy-local-past", pastInTenantWallTime);
        assertScheduledTime("legacy-utc", utcWallTime);
        assertScheduledTime("new-saffron", newWallTime);

        latest.migrate();
        assertScheduledTime("legacy-manual", inUtc(manualWallTime, "Asia/Kolkata"));
        assertScheduledTime("legacy-recurring", inUtc(recurringWallTime, "Asia/Kolkata"));
    }

    private Flyway newFlyway(String schema) {
        return newFlyway("classpath:db/migration,classpath:db/demo-migration", schema);
    }

    private Flyway newFlyway(String locations, String schema) {
        return newFlyway(locations, schema, null);
    }

    private Flyway newFlyway(String locations, String schema, String targetVersion) {
        var configuration = Flyway.configure()
                .dataSource(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD)
                .defaultSchema(schema)
                .schemas(schema)
                .locations(locations.split(","))
                .baselineOnMigrate(true)
                .cleanDisabled(false);
        if (targetVersion != null) {
            configuration.target(MigrationVersion.fromVersion(targetVersion));
        }
        return configuration.load();
    }

    private Connection connection() throws Exception {
        return DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
    }

    private long insertTenant(Connection connection, String slug) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO tenant (slug, name, active, created_at) VALUES (?, ?, TRUE, CURRENT_TIMESTAMP) RETURNING id")) {
            statement.setString(1, slug);
            statement.setString(2, "Legacy tenant");
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getLong(1);
            }
        }
    }

    private long insertRider(Connection connection, long tenantId, String email) throws Exception {
        long userId;
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO app_user (email, password, active, created_time, tenant_id) VALUES (?, 'unused', TRUE, CURRENT_TIMESTAMP, ?) RETURNING id")) {
            statement.setString(1, email);
            statement.setLong(2, tenantId);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                userId = result.getLong(1);
            }
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO rider (user_id, rating, version, tenant_id) VALUES (?, 0, 0, ?) RETURNING id")) {
            statement.setLong(1, userId);
            statement.setLong(2, tenantId);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getLong(1);
            }
        }
    }

    private long insertRecurringTemplate(Connection connection, long tenantId, long riderId,
                                         LocalDateTime createdAt) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO recurring_trip_template (
                    tenant_id, rider_id, days_of_week, local_time, start_date, end_date,
                    pickup_location, drop_off_location, payment_method, created_at, updated_at, version
                ) VALUES (?, ?, 'MONDAY', TIME '09:00', CURRENT_DATE, CURRENT_DATE + 30,
                    ST_SetSRID(ST_MakePoint(77.5::double precision, 12.9::double precision), 4326),
                    ST_SetSRID(ST_MakePoint(77.6::double precision, 13.0::double precision), 4326),
                    'WALLET', ?, ?, 0) RETURNING id
                """)) {
            statement.setLong(1, tenantId);
            statement.setLong(2, riderId);
            statement.setObject(3, createdAt);
            statement.setObject(4, createdAt);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getLong(1);
            }
        }
    }

    private void insertScheduledRequest(Connection connection, long tenantId, long riderId, String reference,
                                         LocalDateTime scheduledTime, LocalDateTime requestedTime,
                                         Long recurringTemplateId, LocalDate occurrenceDate) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO ride_request (
                    tenant_id, rider_id, requested_time, scheduled_time, payment_method,
                    ride_request_status, fare, version, recurring_template_id, occurrence_date, external_reference
                ) VALUES (?, ?, ?, ?, 'WALLET', 'SCHEDULED', 1.00, 0, ?, ?, ?)
                """)) {
            statement.setLong(1, tenantId);
            statement.setLong(2, riderId);
            statement.setObject(3, requestedTime);
            statement.setObject(4, scheduledTime);
            if (recurringTemplateId == null) statement.setNull(5, java.sql.Types.BIGINT);
            else statement.setLong(5, recurringTemplateId);
            if (occurrenceDate == null) statement.setNull(6, java.sql.Types.DATE);
            else statement.setObject(6, occurrenceDate);
            statement.setString(7, reference);
            statement.executeUpdate();
        }
    }

    /**
     * PostgreSQL timestamps have microsecond precision while a Linux JVM clock reports nanoseconds, so the
     * server rounds (or drops) the extra digits. Truncating first keeps a written instant identical to the
     * one read back, which lets the assertions below compare exactly.
     */
    private static LocalDateTime now() {
        return LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }

    private LocalDateTime inUtc(LocalDateTime localTime, String zone) {
        return localTime.atZone(ZoneId.of(zone)).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private void assertScheduledTime(String reference, LocalDateTime expected) throws Exception {
        try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(
                "SELECT scheduled_time FROM " + schemaName + ".ride_request WHERE external_reference = ?")) {
            statement.setString(1, reference);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getObject(1, LocalDateTime.class)).isEqualTo(expected);
            }
        }
    }

    private void ensurePostgisExtension() throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE EXTENSION IF NOT EXISTS postgis");
        }
    }

    private long count(String schema, String table) throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT COUNT(*) FROM " + schema + "." + table)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private void assertSeededFaresFollowPricingFormula(String schema) throws Exception {
        List<SeededFare> fares = List.of(
                new SeededFare("ride_request", "default", "DEMO-VELO-PENDING-01", 34.810),
                new SeededFare("ride_request", "default", "DEMO-VELO-SCHEDULED-01", 3.791),
                new SeededFare("ride_request", "default", "DEMO-VELO-SCHEDULED-02", 35.171),
                new SeededFare("ride_request", "saffron-routes", "DEMO-SAFFRON-PENDING-01", 34.374),
                new SeededFare("ride_request", "saffron-routes", "DEMO-SAFFRON-SCHEDULED-01", 36.128),
                new SeededFare("ride_request", "saffron-routes", "DEMO-SAFFRON-SCHEDULED-02", 4.337),
                new SeededFare("ride_request", "default", "DEMO-VELO-RIDE-ENDED-01", 6.683),
                new SeededFare("ride_request", "default", "DEMO-VELO-RIDE-CANCELLED-01", 5.817),
                new SeededFare("ride_request", "default", "DEMO-VELO-RIDE-ONGOING-01", 6.683),
                new SeededFare("ride_request", "default", "DEMO-VELO-RIDE-ENDED-02", 3.791),
                new SeededFare("ride_request", "default", "DEMO-VELO-RIDE-ENDED-03", 6.683),
                new SeededFare("ride_request", "saffron-routes", "DEMO-SAFFRON-RIDE-ENDED-01", 38.919),
                new SeededFare("ride_request", "saffron-routes", "DEMO-SAFFRON-RIDE-ENDED-02", 2.980),
                new SeededFare("ride_request", "saffron-routes", "DEMO-SAFFRON-RIDE-ONGOING-01", 40.100),
                new SeededFare("ride", "default", "DEMO-VELO-ENDED-01", 6.683),
                new SeededFare("ride", "default", "DEMO-VELO-CANCELLED-01", 5.817),
                new SeededFare("ride", "default", "DEMO-VELO-ONGOING-01", 6.683),
                new SeededFare("ride", "default", "DEMO-VELO-ENDED-02", 3.791),
                new SeededFare("ride", "default", "DEMO-VELO-ENDED-03", 6.683),
                new SeededFare("ride", "saffron-routes", "DEMO-SAFFRON-ENDED-01", 38.919),
                new SeededFare("ride", "saffron-routes", "DEMO-SAFFRON-ENDED-02", 2.980),
                new SeededFare("ride", "saffron-routes", "DEMO-SAFFRON-ONGOING-01", 40.100)
        );

        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD)) {
            for (SeededFare seededFare : fares) {
                String query = "SELECT fixture_row.fare, tenant.base_fare, tenant.per_km_rate, tenant.minimum_fare FROM "
                        + schema + "." + seededFare.table() + " fixture_row JOIN " + schema
                        + ".tenant tenant ON tenant.id = fixture_row.tenant_id "
                        + "WHERE tenant.slug = ? AND fixture_row.external_reference = ?";
                try (PreparedStatement statement = connection.prepareStatement(query)) {
                    statement.setString(1, seededFare.tenantSlug());
                    statement.setString(2, seededFare.reference());
                    try (ResultSet result = statement.executeQuery()) {
                        assertThat(result.next()).as("fixture %s.%s exists", seededFare.table(), seededFare.reference())
                                .isTrue();
                        BigDecimal fare = result.getBigDecimal(1);
                        double formula = Math.max(result.getBigDecimal(4).doubleValue(),
                                result.getBigDecimal(2).doubleValue()
                                        + result.getBigDecimal(3).doubleValue() * seededFare.routeDistanceKm());
                        assertThat(fare.doubleValue())
                                .as("%s.%s should use %s's tariff", seededFare.table(), seededFare.reference(), seededFare.tenantSlug())
                                .isCloseTo(formula, offset(formula * 0.15));
                    }
                }
            }
        }
    }

    private long countSeededRatingRows(String schema) throws Exception {
        String query = "SELECT COUNT(*) FROM " + schema + ".rating rating JOIN " + schema
                + ".ride ride ON ride.id = rating.ride_id WHERE ride.external_reference IN "
                + "('DEMO-VELO-ENDED-01', 'DEMO-VELO-ENDED-02', 'DEMO-VELO-ENDED-03', "
                + "'DEMO-SAFFRON-ENDED-01', 'DEMO-SAFFRON-ENDED-02')";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            result.next();
            return result.getLong(1);
        }
    }

    private void assertTenantTariff(String slug, String baseFare, String perKmRate, String minimumFare) throws Exception {
        String sql = "SELECT base_fare, per_km_rate, minimum_fare FROM " + schemaName + ".tenant WHERE slug = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, slug);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getBigDecimal(1)).isEqualByComparingTo(baseFare);
                assertThat(result.getBigDecimal(2)).isEqualByComparingTo(perKmRate);
                assertThat(result.getBigDecimal(3)).isEqualByComparingTo(minimumFare);
            }
        }
    }

    private void assertTenantServiceArea(String slug, double latitude, double longitude, double radiusKm)
            throws Exception {
        String sql = "SELECT service_area_latitude, service_area_longitude, service_area_radius_km FROM "
                + schemaName + ".tenant WHERE slug = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, slug);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getDouble(1)).isEqualTo(latitude);
                assertThat(result.getDouble(2)).isEqualTo(longitude);
                assertThat(result.getDouble(3)).isEqualTo(radiusKm);
            }
        }
    }

    private record SeededFare(String table, String tenantSlug, String reference, double routeDistanceKm) { }

    private void assertSaffronEarningsPayoutAndWalletUseTariff() throws Exception {
        String earningQuery = "SELECT ride.fare, earning.gross_fare, earning.platform_commission, earning.net_earning "
                + "FROM " + schemaName + ".ride ride JOIN " + schemaName
                + ".driver_earning earning ON earning.ride_id = ride.id "
                + "WHERE ride.external_reference = 'DEMO-SAFFRON-ENDED-01'";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(earningQuery)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getBigDecimal(1)).isEqualByComparingTo("1612.17");
            assertThat(result.getBigDecimal(2)).isEqualByComparingTo("1612.17");
            assertThat(result.getBigDecimal(3)).isEqualByComparingTo("483.65");
            assertThat(result.getBigDecimal(4)).isEqualByComparingTo("1128.52");
        }

        String payoutQuery = "SELECT payout.amount, wallet.balance FROM " + schemaName
                + ".payout_request payout JOIN " + schemaName + ".driver driver ON driver.id = payout.driver_id "
                + "JOIN " + schemaName + ".app_user account ON account.id = driver.user_id JOIN " + schemaName
                + ".wallet wallet ON wallet.user_id = account.id AND wallet.tenant_id = payout.tenant_id "
                + "WHERE account.email = 'chauffeur2@saffronroutes.demo' AND payout.status = 'PROCESSED' "
                + "AND payout.requested_at = TIMESTAMP '2026-10-13 15:20:00'";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(payoutQuery)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getBigDecimal(1)).isEqualByComparingTo("420.00");
            assertThat(result.getBigDecimal(2)).isEqualByComparingTo("420.00");
        }
    }

    private long countByTenantSlug(String table, String slug) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + "." + table + " row "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = row.tenant_id WHERE tenant.slug = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, slug);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countSimulatedAccounts(String tenantSlug) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".app_user user_account "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = user_account.tenant_id "
                + "WHERE tenant.slug = ? AND user_account.simulated = TRUE";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tenantSlug);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private void assertVeloBusinessDisplayNames() throws Exception {
        assertThat(userDisplayName("admin@velo-platform.com")).isEqualTo("Nadia Farouk");
        assertThat(userDisplayName("alice@example.com")).isEqualTo("Alice Moreau");
        assertThat(userDisplayName("bob.driver@example.com")).isEqualTo("Bob Lindqvist");
        assertThat(userDisplayName("carol.driver@example.com")).isEqualTo("Carol Mendes");
        assertThat(userDisplayName("dave@example.com")).isEqualTo("Dave Okafor");
        assertThat(userDisplayName("henry@example.com")).isEqualTo("Henry Walsh");
        assertThat(userDisplayName("frank@example.com")).isEqualTo("Frank Mensah");
        assertThat(userDisplayName("eve.driver@example.com")).isEqualTo("Eve Petrov");
        assertThat(userDisplayName("grace.driver@example.com")).isEqualTo("Grace Kim");
    }

    private String userDisplayName(String email) throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT first_name || ' ' || last_name FROM " + schemaName + ".app_user WHERE email = ?")) {
            statement.setString(1, email);
            try (ResultSet resultSet = statement.executeQuery()) {
                assertThat(resultSet.next()).as("seeded user %s exists", email).isTrue();
                return resultSet.getString(1);
            }
        }
    }

    private void updateUserDisplayName(String email, String firstName, String lastName) throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(
                     "UPDATE " + schemaName + ".app_user SET first_name = ?, last_name = ? WHERE email = ?")) {
            statement.setString(1, firstName);
            statement.setString(2, lastName);
            statement.setString(3, email);
            statement.executeUpdate();
        }
    }

    private void rerunTenantSeed(Flyway flyway) throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("DELETE FROM " + schemaName
                    + ".flyway_schema_history WHERE script = 'R__demo_tenants.sql'");
        }
        flyway.migrate();
    }

    private long countTenantSlug(String slug) throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT COUNT(*) FROM " + schemaName + ".tenant WHERE slug = ?")) {
            statement.setString(1, slug);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countAuditReason(String reason) throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT COUNT(*) FROM " + schemaName + ".admin_dispatch_audit WHERE reason = ?")) {
            statement.setString(1, reason);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countRideByOtpStatus(String otp, String status) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".ride ride "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = ride.tenant_id "
                + "WHERE tenant.slug = 'default' AND ride.otp = ? AND ride.ride_status = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, otp);
            statement.setString(2, status);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countPaymentByRideOtpStatus(String otp, String paymentStatus) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".payment payment "
                + "JOIN " + schemaName + ".ride ride ON ride.id = payment.ride_id "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = ride.tenant_id "
                + "WHERE tenant.slug = 'saffron-routes' AND ride.otp = ? AND payment.payment_status = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, otp);
            statement.setString(2, paymentStatus);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countRideFixture(String externalReference, String riderEmail, String driverEmail, String status)
            throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".ride ride "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = ride.tenant_id "
                + "JOIN " + schemaName + ".rider rider ON rider.id = ride.rider_id AND rider.tenant_id = tenant.id "
                + "JOIN " + schemaName + ".app_user rider_user ON rider_user.id = rider.user_id "
                + "JOIN " + schemaName + ".driver driver ON driver.id = ride.driver_id AND driver.tenant_id = tenant.id "
                + "JOIN " + schemaName + ".app_user driver_user ON driver_user.id = driver.user_id "
                + "WHERE tenant.slug = 'default' AND ride.external_reference = ? AND ride.ride_status = ? "
                + "AND rider_user.email = ? AND driver_user.email = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, externalReference);
            statement.setString(2, status);
            statement.setString(3, riderEmail);
            statement.setString(4, driverEmail);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countRidesByStatus(String tenantSlug, String status) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".ride ride "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = ride.tenant_id "
                + "WHERE tenant.slug = ? AND ride.ride_status = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tenantSlug);
            statement.setString(2, status);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countRequestFixture(String externalReference, String riderEmail, String status) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".ride_request request "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = request.tenant_id "
                + "JOIN " + schemaName + ".rider rider ON rider.id = request.rider_id AND rider.tenant_id = tenant.id "
                + "JOIN " + schemaName + ".app_user rider_user ON rider_user.id = rider.user_id "
                + "WHERE tenant.slug = 'default' AND request.external_reference = ? "
                + "AND request.ride_request_status = ? AND rider_user.email = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, externalReference);
            statement.setString(2, status);
            statement.setString(3, riderEmail);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }

    private long countBranding(String tenantSlug, String brandName, String primaryColor, String riderLabel,
                               String driverLabel, String tripLabel, String currency) throws Exception {
        String sql = "SELECT COUNT(*) FROM " + schemaName + ".tenant_configuration configuration "
                + "JOIN " + schemaName + ".tenant tenant ON tenant.id = configuration.tenant_id "
                + "WHERE tenant.slug = ? AND configuration.brand_name = ? "
                + "AND configuration.primary_color = ? AND configuration.rider_label = ? "
                + "AND configuration.driver_label = ? AND configuration.trip_label = ? AND configuration.currency = ?";
        try (Connection connection = DriverManager.getConnection(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tenantSlug);
            statement.setString(2, brandName);
            statement.setString(3, primaryColor);
            statement.setString(4, riderLabel);
            statement.setString(5, driverLabel);
            statement.setString(6, tripLabel);
            statement.setString(7, currency);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1);
            }
        }
    }
}
