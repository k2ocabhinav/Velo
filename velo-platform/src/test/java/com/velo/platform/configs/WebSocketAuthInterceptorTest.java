package com.velo.platform.configs;

import com.velo.platform.security.JwtTokenProvider;
import com.velo.platform.security.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class WebSocketAuthInterceptorTest {

    private static final String SECRET = "testSecretKeyForJWTTokenGenerationThatIsLongEnoughForHS512Algorithm123456789";
    private final JwtTokenProvider jwtTokenProvider = new JwtTokenProvider(SECRET, 3_600_000);
    private final WebSocketAuthInterceptor interceptor = new WebSocketAuthInterceptor(jwtTokenProvider);
    private final MessageChannel channel = mock(MessageChannel.class);

    @AfterEach
    void clearSecurityContext() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    @Test
    void connectAcceptsWebSocketTicketAndSetsPrincipal() {
        String ticket = jwtTokenProvider.generateWebSocketTicket("rider@example.test", 8L, "RIDER", 2L);
        Message<?> message = connectMessage(ticket);

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertThat(accessor).isNotNull();
        assertThat(accessor.getUser()).isInstanceOf(UsernamePasswordAuthenticationToken.class);
        UsernamePasswordAuthenticationToken authentication =
                (UsernamePasswordAuthenticationToken) accessor.getUser();
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        assertThat(principal.getUserId()).isEqualTo(8L);
        assertThat(principal.getTenantId()).isEqualTo(2L);
    }

    @Test
    void connectRejectsNormalRestJwt() {
        String accessToken = jwtTokenProvider.generateToken("rider@example.test", 8L, "RIDER", 2L);

        assertThat(interceptor.preSend(connectMessage(accessToken), channel)).isNull();
    }

    private Message<?> connectMessage(String ticket) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer " + ticket);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
