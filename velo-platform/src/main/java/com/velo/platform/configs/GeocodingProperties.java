package com.velo.platform.configs;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.geocoding")
public class GeocodingProperties {
    private String baseUrl = "http://localhost:7070";
    private String userAgent = "VeloPlatform/1.0 (geocoding)";
    private String email = "";
    private String countryBias = "";
    private Duration timeout = Duration.ofSeconds(3);
    private Duration cacheTtl = Duration.ofHours(24);
    private Double serviceAreaLatitude;
    private Double serviceAreaLongitude;
}
