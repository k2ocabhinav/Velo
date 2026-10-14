package com.velo.platform.configs;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.auth.rate-limit")
public class AuthRateLimitProperties {
    private boolean enabled = true;
    private boolean redisEnabled = true;
    private Duration window = Duration.ofMinutes(1);
    private int ipLimit = 60;
    private int accountLimit = 10;
    private String trustedProxies = "";
}
