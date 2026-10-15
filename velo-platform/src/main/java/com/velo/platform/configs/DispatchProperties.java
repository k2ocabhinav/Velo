package com.velo.platform.configs;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "velo.dispatch")
public class DispatchProperties {
    private long offerTtlSeconds = 45;
}
