package com.velo.platform.configs;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebSocketConfigTest {

    @Test
    void websocketEndpoint_UsesConfiguredExactOrigins() {
        StompEndpointRegistry registry = mock(StompEndpointRegistry.class);
        StompWebSocketEndpointRegistration endpoint = mock(StompWebSocketEndpointRegistration.class);
        when(registry.addEndpoint("/ws")).thenReturn(endpoint);
        when(endpoint.setAllowedOrigins("https://admin.example.com", "https://rider.example.com"))
                .thenReturn(endpoint);

        WebSocketConfig config = new WebSocketConfig(mock(WebSocketAuthInterceptor.class));
        ReflectionTestUtils.setField(config, "allowedOriginsProperty", "https://admin.example.com,https://rider.example.com");

        config.registerStompEndpoints(registry);

        verify(endpoint).setAllowedOrigins("https://admin.example.com", "https://rider.example.com");
    }
}
