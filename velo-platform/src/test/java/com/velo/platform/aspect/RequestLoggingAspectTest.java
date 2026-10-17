package com.velo.platform.aspect;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.velo.platform.exceptions.BadRequestException;
import com.velo.platform.exceptions.RateLimitExceededException;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import jakarta.validation.ConstraintViolationException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.ErrorResponseException;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RequestLoggingAspectTest {

    private final RequestLoggingAspect aspect = new RequestLoggingAspect();

    @Test
    void mappedClientErrorsAreWarnedWithoutStackTraces() throws Throwable {
        List<Exception> exceptions = List.of(
                new ResourceNotFoundException("missing"),
                new RuntimeConflictException("conflict"),
                new BadRequestException("invalid"),
                new RateLimitExceededException(10),
                new AccessDeniedException("forbidden"),
                new ConstraintViolationException("invalid", Set.of()),
                new ErrorResponseException(HttpStatus.BAD_REQUEST)
        );
        Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingAspect.class);
        Level originalLevel = logger.getLevel();
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.setLevel(Level.DEBUG);
        logger.addAppender(appender);

        try {
            for (Exception exception : exceptions) {
                ProceedingJoinPoint joinPoint = failingControllerJoinPoint(exception);
                assertThatThrownBy(() -> aspect.logControllerMethods(joinPoint)).isSameAs(exception);
            }

            List<ILoggingEvent> rejectionLogs = appender.list.stream()
                    .filter(event -> event.getFormattedMessage().startsWith("Rejected "))
                    .toList();
            assertThat(rejectionLogs).hasSize(exceptions.size());
            assertThat(rejectionLogs).allSatisfy(event -> {
                assertThat(event.getLevel()).isEqualTo(Level.WARN);
                assertThat(event.getThrowableProxy()).isNull();
            });
            assertThat(appender.list).noneMatch(event -> event.getLevel() == Level.ERROR);
        } finally {
            logger.detachAppender(appender);
            logger.setLevel(originalLevel);
            appender.stop();
        }
    }

    @Test
    void unexpectedErrorsRemainAtErrorLevel() throws Throwable {
        Exception exception = new IllegalStateException("unexpected");
        Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingAspect.class);
        Level originalLevel = logger.getLevel();
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.setLevel(Level.DEBUG);
        logger.addAppender(appender);

        try {
            ProceedingJoinPoint joinPoint = failingControllerJoinPoint(exception);
            assertThatThrownBy(() -> aspect.logControllerMethods(joinPoint)).isSameAs(exception);

            assertThat(appender.list)
                    .anySatisfy(event -> assertThat(event.getLevel()).isEqualTo(Level.ERROR));
            assertThat(appender.list).noneMatch(event -> event.getLevel() == Level.WARN);
        } finally {
            logger.detachAppender(appender);
            logger.setLevel(originalLevel);
            appender.stop();
        }
    }

    private ProceedingJoinPoint failingControllerJoinPoint(Exception exception) throws Throwable {
        ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);
        Signature signature = mock(Signature.class);
        when(joinPoint.getSignature()).thenReturn(signature);
        when(joinPoint.getTarget()).thenReturn(new ControllerFixture());
        when(signature.getName()).thenReturn("handle");
        doThrow(exception).when(joinPoint).proceed();
        return joinPoint;
    }

    private static final class ControllerFixture {
    }
}
