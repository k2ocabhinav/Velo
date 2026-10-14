package com.velo.platform.configs;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionProfilePropertiesTest {

    @Test
    void prodAndStagingDisableSchemaMutationSqlLoggingAndDevelopmentRedisDefaults() throws IOException {
        for (String profile : new String[]{"prod", "staging"}) {
            Properties properties = loadProfile(profile);

            assertThat(properties.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
            assertThat(properties.getProperty("spring.jpa.show-sql")).isEqualTo("false");
            assertThat(properties.getProperty("spring.jpa.properties.hibernate.format_sql")).isEqualTo("false");
            assertThat(properties.getProperty("spring.jpa.open-in-view")).isEqualTo("false");
            assertThat(properties.getProperty("spring.data.redis.host")).isEqualTo("${SPRING_DATA_REDIS_HOST}");
            assertThat(properties.getProperty("spring.data.redis.ssl.enabled")).isEqualTo("true");
            assertThat(properties.getProperty("server.forward-headers-strategy")).isEqualTo("framework");
            assertThat(properties.getProperty("springdoc.api-docs.enabled")).isEqualTo("false");
        }
    }

    private Properties loadProfile(String profile) throws IOException {
        Properties properties = new Properties();
        try (var stream = getClass().getResourceAsStream("/application-" + profile + ".properties")) {
            assertThat(stream).as("application-%s.properties exists", profile).isNotNull();
            properties.load(stream);
        }
        return properties;
    }
}
