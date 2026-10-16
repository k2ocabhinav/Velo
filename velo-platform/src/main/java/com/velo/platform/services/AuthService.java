package com.velo.platform.services;

import com.velo.platform.dto.AuthResponseDto;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.ForgotPasswordRequestDto;
import com.velo.platform.dto.ResetPasswordRequestDto;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.dto.UpdateProfileRequestDto;
import com.velo.platform.dto.UserDto;

import java.util.Map;

public interface AuthService {

    // Returns Tokens
    AuthResponseDto login(String email, String password);

    AuthResponseDto refresh(String refreshToken);

    void logout(String refreshToken);

    UserDto signup(SignupDto signupDto);

    /**
     * Anonymous self-registration resolved to the tenant the caller's host maps to. An
     * authenticated caller (an admin creating a rider) always signs up in their own tenant,
     * so {@code tenantSlug} is ignored in that case.
     */
    UserDto signup(SignupDto signupDto, String tenantSlug);

    DriverDto onboardNewDriver(Long userId, String vehicleId);

    UserDto updateProfile(UpdateProfileRequestDto requestDto);

    Map<String, String> forgotPassword(ForgotPasswordRequestDto requestDto);

    Map<String, String> resetPassword(ResetPasswordRequestDto requestDto);

}
