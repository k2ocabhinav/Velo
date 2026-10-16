package com.velo.platform.configs;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.StandardEnvironment;

import java.time.ZoneId;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

class UtcTimeZoneEnvironmentPostProcessorTest {

    @AfterEach
    void keepTestJvmOnUtc() {
        UtcTimeZone.setDefault();
    }

    @Test
    void environmentPostProcessorForcesUtcBeforeContextCreation() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        System.setProperty("user.timezone", "Asia/Kolkata");

        new UtcTimeZoneEnvironmentPostProcessor().postProcessEnvironment(
                new StandardEnvironment(), new SpringApplication());

        assertThat(TimeZone.getDefault().getID()).isEqualTo("UTC");
        assertThat(ZoneId.systemDefault()).isEqualTo(ZoneId.of("UTC"));
        assertThat(System.getProperty("user.timezone")).isEqualTo("UTC");
    }
}
