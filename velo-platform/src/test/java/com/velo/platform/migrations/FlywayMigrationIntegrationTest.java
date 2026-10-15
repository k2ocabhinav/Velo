package com.velo.platform.migrations;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

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
        assertThat(countByTenantSlug("app_user", "default")).isGreaterThanOrEqualTo(5);
        assertThat(countByTenantSlug("app_user", "saffron-routes")).isEqualTo(5);
        assertThat(countByTenantSlug("driver", "default")).isGreaterThanOrEqualTo(2);
        assertThat(countByTenantSlug("driver", "saffron-routes")).isEqualTo(2);
        assertThat(countByTenantSlug("ride", "default")).isGreaterThanOrEqualTo(5);
        assertThat(countByTenantSlug("ride", "saffron-routes")).isGreaterThanOrEqualTo(3);
        assertThat(countRideByOtpStatus("1357", "ENDED")).isEqualTo(1);
        assertThat(countRideByOtpStatus("1357", "CONFIRMED")).isZero();
        assertThat(countPaymentByRideOtpStatus("4826", "PENDING")).isEqualTo(1);
        assertThat(countByTenantSlug("payout_request", "default")).isGreaterThanOrEqualTo(2);
        assertThat(countByTenantSlug("payout_request", "saffron-routes")).isEqualTo(2);
        assertThat(countBranding("saffron-routes", "Saffron Routes", "#8A3D2B", "Guest", "Chauffeur", "Transfer", "INR")).isEqualTo(1);
        assertThat(countBranding("default", "Velo Business", "#1A56FF", "Rider", "Driver", "Trip", "USD")).isEqualTo(1);

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
    }

    private Flyway newFlyway(String schema) {
        return newFlyway("classpath:db/migration,classpath:db/demo-migration", schema);
    }

    private Flyway newFlyway(String locations, String schema) {
        var configuration = Flyway.configure()
                .dataSource(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD)
                .defaultSchema(schema)
                .schemas(schema)
                .locations(locations.split(","))
                .baselineOnMigrate(true)
                .cleanDisabled(false);
        return configuration.load();
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
