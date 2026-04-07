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

    UserDto signup(SignupDto signupDto);

    DriverDto onboardNewDriver(Long userId, String vehicleId);

    UserDto updateProfile(UpdateProfileRequestDto requestDto);

    Map<String, String> forgotPassword(ForgotPasswordRequestDto requestDto);

    Map<String, String> resetPassword(ResetPasswordRequestDto requestDto);

}
