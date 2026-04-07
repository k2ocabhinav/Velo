package com.velo.platform.controllers;

import com.velo.platform.dto.AuthResponseDto;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.OnboardDriverDto;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    ResponseEntity<UserDto> signUp(@RequestBody SignupDto signupDto) {
        return new ResponseEntity<>(authService.signup(signupDto), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    ResponseEntity<AuthResponseDto> login(@RequestBody Map<String, String> credentials) {
        return ResponseEntity.ok(authService.login(credentials.get("email"), credentials.get("password")));
    }

    @PostMapping("/onBoardNewDriver/{userId}")
    ResponseEntity<DriverDto> onBoardNewDriver(@PathVariable Long userId, @RequestBody OnboardDriverDto onboardDriverDto) {
        return new ResponseEntity<>(authService.onboardNewDriver(userId,
                onboardDriverDto.getVehicleId()), HttpStatus.CREATED);
    }

}
