package com.velo.platform.configs;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DispatchPropertiesTest {

    @Test
    void offerTtlDefaultsToFortyFiveSeconds() {
        DispatchProperties properties = new DispatchProperties();

        assertThat(properties.getOfferTtlSeconds()).isEqualTo(45L);
    }

    @Test
    void offerTtlBindsFromDispatchProperty() {
        Binder binder = new Binder(new MapConfigurationPropertySource(
                Map.of("velo.dispatch.offer-ttl-seconds", "90")
        ));

        DispatchProperties properties = binder.bindOrCreate("velo.dispatch", Bindable.of(DispatchProperties.class));

        assertThat(properties.getOfferTtlSeconds()).isEqualTo(90L);
    }
}
