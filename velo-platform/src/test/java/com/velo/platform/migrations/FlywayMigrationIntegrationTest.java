package com.velo.platform.migrations;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class FlywayMigrationIntegrationTest {

    private static final String JDBC_URL = System.getProperty("velo.test.flyway.url", "jdbc:postgresql://localhost:5432/testpostgres");
    private static final String JDBC_USERNAME = System.getProperty("velo.test.flyway.username", "postgres");
    private static final String JDBC_PASSWORD = System.getProperty("velo.test.flyway.password", "user");

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

    private Flyway newFlyway(String schema) {
        return Flyway.configure()
                .dataSource(JDBC_URL, JDBC_USERNAME, JDBC_PASSWORD)
                .defaultSchema(schema)
                .schemas(schema)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .cleanDisabled(false)
                .load();
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
}
