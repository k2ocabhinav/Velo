package com.velo.platform.configs;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI veloPlatformApi() {
        return new OpenAPI().info(new Info().title("Velo Platform API").version("v0"));
    }
}
