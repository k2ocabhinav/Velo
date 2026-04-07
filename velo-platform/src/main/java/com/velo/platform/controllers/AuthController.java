package com.velo.platform.controllers;

import com.velo.platform.dto.AuthResponseDto;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.ForgotPasswordRequestDto;
import com.velo.platform.dto.OnboardDriverDto;
import com.velo.platform.dto.ResetPasswordRequestDto;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.dto.UpdateProfileRequestDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.services.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Authentication and driver onboarding APIs")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    @Operation(summary = "Create a new rider account")
    public ResponseEntity<UserDto> signUp(@RequestBody @Valid SignupDto signupDto) {
        return new ResponseEntity<>(authService.signup(signupDto), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate a user and return a JWT")
    public ResponseEntity<AuthResponseDto> login(@RequestBody Map<String, String> credentials) {
        return ResponseEntity.ok(authService.login(credentials.get("email"), credentials.get("password")));
    }

    @PostMapping("/onBoardNewDriver/{userId}")
    @Operation(summary = "Complete driver onboarding for an existing user")
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
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody @Valid ForgotPasswordRequestDto requestDto) {
        return ResponseEntity.ok(authService.forgotPassword(requestDto));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with token")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody @Valid ResetPasswordRequestDto requestDto) {
        return ResponseEntity.ok(authService.resetPassword(requestDto));
    }
}