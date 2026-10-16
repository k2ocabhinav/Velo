package com.velo.platform.controllers;

import com.velo.platform.dto.AuthResponseDto;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.ForgotPasswordRequestDto;
import com.velo.platform.dto.LoginRequestDto;
import com.velo.platform.dto.OnboardDriverDto;
import com.velo.platform.dto.ResetPasswordRequestDto;
import com.velo.platform.dto.RefreshTokenRequestDto;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.dto.UpdateProfileRequestDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.dto.WebSocketTicketResponseDto;
import com.velo.platform.security.JwtTokenProvider;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.AuthService;
import com.velo.platform.services.impl.AuthRateLimitService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Authentication and driver onboarding APIs")
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthRateLimitService authRateLimitService;

    @PostMapping("/signup")
    @Operation(summary = "Create a new rider account")
    public ResponseEntity<UserDto> signUp(
            @RequestBody @Valid SignupDto signupDto,
            @RequestHeader(value = "X-Velo-Tenant-Slug", required = false) String tenantSlug,
            HttpServletRequest request) {
        authRateLimitService.check(request, signupDto.getEmail());
        return new ResponseEntity<>(authService.signup(signupDto, tenantSlug), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate a user and return a JWT")
    public ResponseEntity<AuthResponseDto> login(@RequestBody @Valid LoginRequestDto credentials, HttpServletRequest request) {
        authRateLimitService.check(request, credentials.getEmail());
        return ResponseEntity.ok(authService.login(credentials.getEmail(), credentials.getPassword()));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate a refresh token and issue a new access token")
    public ResponseEntity<AuthResponseDto> refresh(@RequestBody @Valid RefreshTokenRequestDto requestDto,
                                                   HttpServletRequest request) {
        authRateLimitService.check(request, requestDto.getRefreshToken());
        return ResponseEntity.ok(authService.refresh(requestDto.getRefreshToken()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the refresh token family")
    public ResponseEntity<Map<String, String>> logout(@RequestBody @Valid RefreshTokenRequestDto requestDto,
                                                       HttpServletRequest request) {
        authRateLimitService.check(request, requestDto.getRefreshToken());
        authService.logout(requestDto.getRefreshToken());
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @PostMapping("/ws-ticket")
    @Operation(summary = "Issue a short-lived ticket for WebSocket authentication")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<WebSocketTicketResponseDto> createWebSocketTicket(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        authRateLimitService.check(request, principal.getEmail());
        String ticket = jwtTokenProvider.generateWebSocketTicket(
                principal.getEmail(), principal.getUserId(), principal.getRole(), principal.getTenantId());
        return ResponseEntity.ok(new WebSocketTicketResponseDto(
                ticket, JwtTokenProvider.WEBSOCKET_TICKET_TTL_SECONDS));
    }

    @PostMapping("/onBoardNewDriver/{userId}")
    @Operation(summary = "Complete driver onboarding for an existing user")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<DriverDto> onBoardNewDriver(@PathVariable Long userId, @RequestBody @Valid OnboardDriverDto onboardDriverDto) {
        return new ResponseEntity<>(authService.onboardNewDriver(userId, onboardDriverDto.getVehicleId()), HttpStatus.CREATED);
    }

    @PutMapping("/profile")
    @Operation(summary = "Update current user's profile")
    public ResponseEntity<UserDto> updateProfile(@RequestBody @Valid UpdateProfileRequestDto requestDto) {
        return ResponseEntity.ok(authService.updateProfile(requestDto));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody @Valid ForgotPasswordRequestDto requestDto,
                                                              HttpServletRequest request) {
        authRateLimitService.check(request, requestDto.getEmail());
        return ResponseEntity.ok(authService.forgotPassword(requestDto));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with token")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody @Valid ResetPasswordRequestDto requestDto,
                                                             HttpServletRequest request) {
        authRateLimitService.check(request, requestDto.getToken());
        return ResponseEntity.ok(authService.resetPassword(requestDto));
    }
}
