package com.velo.platform.advices;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import com.velo.platform.exceptions.RateLimitExceededException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    @Test
    void genericServerErrorReturnsGenericMessage() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        var response = handler.handleInternalServerError(new IllegalStateException("SQL password=secret"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().getError().getMessage()).isEqualTo("An unexpected error occurred");
        assertThat(response.getBody().getError().getMessage()).doesNotContain("secret", "SQL");
    }

    @Test
    void rateLimitErrorUsesApiEnvelopeAndRetryAfterHeader() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        var response = handler.handleRateLimitExceeded(new RateLimitExceededException(17));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("17");
        assertThat(response.getBody().getError().getMessage()).contains("Too many authentication requests");
    }
}
