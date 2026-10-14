package com.velo.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

/**
 * Enforces the scheme reported by the trusted TLS-terminating load balancer.
 * Requests without X-Forwarded-Proto are allowed for private target health checks.
 */
public class ForwardedHttpsEnforcementFilter extends OncePerRequestFilter {

    private static final String HSTS_VALUE = "max-age=31536000; includeSubDomains";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        if (forwardedProto != null) {
            String clientProto = forwardedProto.split(",", 2)[0].trim().toLowerCase(Locale.ROOT);
            if ("http".equals(clientProto)) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "HTTPS is required");
                return;
            }
            if ("https".equals(clientProto)) {
                response.setHeader("Strict-Transport-Security", HSTS_VALUE);
            }
        }
        filterChain.doFilter(request, response);
    }
}
