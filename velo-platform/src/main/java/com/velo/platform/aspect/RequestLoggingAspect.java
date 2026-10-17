package com.velo.platform.aspect;

import com.velo.platform.exceptions.BadRequestException;
import com.velo.platform.exceptions.InvalidRefreshTokenException;
import com.velo.platform.exceptions.RateLimitExceededException;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.security.CorrelationIdFilter;
import jakarta.persistence.OptimisticLockException;
import jakarta.validation.ConstraintViolationException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatusCode;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;
import org.springframework.web.ErrorResponse;

@Aspect
@Component
public class RequestLoggingAspect {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingAspect.class);

    @Pointcut("execution(* com.velo.platform.controllers..*(..))")
    public void controllerMethods() {}

    @Around("controllerMethods()")
    public Object logControllerMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String correlationId = MDC.get(CorrelationIdFilter.CORRELATION_ID);
        
        log.info("Starting {}.{} | correlationId={}", className, methodName, correlationId);
        
        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startTime;
            log.info("Completed {}.{} in {}ms | correlationId={}", 
                    className, methodName, duration, correlationId);
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            if (isClientError(e)) {
                log.warn("Rejected {}.{} in {}ms | correlationId={} | error={}",
                        className, methodName, duration, correlationId, e.getMessage());
            } else {
                log.error("Failed {}.{} in {}ms | correlationId={} | error={}",
                        className, methodName, duration, correlationId, e.getMessage());
            }
            throw e;
        }
    }

    @Pointcut("execution(* com.velo.platform.services..*(..))")
    public void serviceMethods() {}

    @Around("serviceMethods()")
    public Object logServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        
        log.debug("Service call: {}.{}", className, methodName);
        
        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Service completed: {}.{} in {}ms", className, methodName, duration);
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            if (isClientError(e)) {
                log.warn("Rejected {}.{} in {}ms | error={}",
                        className, methodName, duration, e.getMessage());
            } else {
                log.error("Service failed: {}.{} in {}ms | error={}",
                        className, methodName, duration, e.getMessage());
            }
            throw e;
        }
    }

    private boolean isClientError(Exception exception) {
        if (exception instanceof ErrorResponse errorResponse) {
            HttpStatusCode statusCode = errorResponse.getStatusCode();
            return statusCode.is4xxClientError();
        }

        return exception instanceof ResourceNotFoundException
                || exception instanceof RuntimeConflictException
                || exception instanceof BadRequestException
                || exception instanceof BadCredentialsException
                || exception instanceof InvalidRefreshTokenException
                || exception instanceof RateLimitExceededException
                || exception instanceof AccessDeniedException
                || exception instanceof ConstraintViolationException
                || exception instanceof ObjectOptimisticLockingFailureException
                || exception instanceof OptimisticLockException;
    }
}
