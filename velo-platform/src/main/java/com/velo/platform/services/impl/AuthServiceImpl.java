package com.velo.platform.services.impl;

import com.velo.platform.dto.AuthResponseDto;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.ForgotPasswordRequestDto;
import com.velo.platform.dto.ResetPasswordRequestDto;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.dto.UpdateProfileRequestDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.PasswordResetToken;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.PasswordResetTokenRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.JwtTokenProvider;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.AuthService;
import com.velo.platform.services.DriverService;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.WalletService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.Set;

import static com.velo.platform.entities.enums.Role.DRIVER;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final ModelMapper modelMapper;
    private final RiderService riderService;
    private final WalletService walletService;
    private final DriverService driverService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public AuthResponseDto login(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeConflictException("Invalid password");
        }

        String role = user.getRoles().contains(DRIVER) ? DRIVER.name() : Role.RIDER.name();
        String token = jwtTokenProvider.generateToken(user.getEmail(), user.getId(), role);

        return AuthResponseDto.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .role(role)
                .build();
    }

    @Override
    @Transactional
    public UserDto signup(SignupDto signupDto){

        User user = userRepository.findByEmail(signupDto.getEmail()).orElse(null);
        if(user != null)
            throw new RuntimeConflictException("Cannot signup, User already exists with email "+signupDto.getEmail());

        User mappedUser = modelMapper.map(signupDto, User.class);
        mappedUser.setPassword(passwordEncoder.encode(signupDto.getPassword()));
        mappedUser.setActive(true);
        mappedUser.setRoles(Set.of(Role.RIDER));

        String referralCode = generateReferralCode(signupDto.getName());
        mappedUser.setReferralCode(referralCode);

        User savedUser = userRepository.save(mappedUser);

//      CREATE USER RELATED ENTITIES
//      1. Rider Entity
        riderService.createNewRider(savedUser);

//      TODO 2. Add Wallet related service ✅
        walletService.createNewWallet(savedUser);


        return modelMapper.map(savedUser, UserDto.class);
    }

    private String generateReferralCode(String name) {
        String prefix = (name != null && name.length() >= 4) ? name.substring(0, 4).toUpperCase() : "USER";
        Random random = new Random();
        int code = 100000 + random.nextInt(900000);
        return prefix + code;
    }

    @Override
    @Transactional
    public DriverDto onboardNewDriver(Long userId, String vehicleId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id "+userId));

        if(user.getRoles().contains(DRIVER))
            throw new RuntimeConflictException("User with id "+userId+" is already a Driver");

        Driver createDriver = Driver.builder()
                .user(user)
                .rating(0.0)
                .vehicleId(vehicleId)
                .available(true)
                .build();
user.getRoles().add(DRIVER);
    userRepository.save(user);
    Driver savedDriver = driverService.createNewDriver(createDriver);
    return modelMapper.map(savedDriver, DriverDto.class);
}

@Override
@Transactional
public UserDto updateProfile(UpdateProfileRequestDto requestDto) {
    UserPrincipal principal = (UserPrincipal) org.springframework.security.core.context.SecurityContextHolder
            .getContext().getAuthentication().getPrincipal();

    User user = userRepository.findById(principal.getUserId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + principal.getUserId()));

    user.setFirstName(requestDto.getFirstName());
    user.setLastName(requestDto.getLastName());
    user.setPhoneNumber(requestDto.getPhoneNumber());

    User savedUser = userRepository.save(user);
    return modelMapper.map(savedUser, UserDto.class);
}

@Override
public Map<String, String> forgotPassword(ForgotPasswordRequestDto requestDto) {
    User user = userRepository.findByEmail(requestDto.getEmail())
            .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + requestDto.getEmail()));

    String token = UUID.randomUUID().toString();
    PasswordResetToken resetToken = PasswordResetToken.builder()
            .token(token)
            .user(user)
            .expiryDate(LocalDateTime.now().plusHours(24))
            .used(false)
            .build();

    passwordResetTokenRepository.save(resetToken);

    log.info("Password reset token generated for user: {}", user.getEmail());
    log.debug("Reset token: {} ( expires at: {} )", token, resetToken.getExpiryDate());

    return Map.of(
            "message", "Password reset instructions sent to your email",
            "token", token
    );
}

@Override
public Map<String, String> resetPassword(ResetPasswordRequestDto requestDto) {
    PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(requestDto.getToken())
            .orElseThrow(() -> new ResourceNotFoundException("Invalid or expired reset token"));

    if (!resetToken.isValid()) {
        throw new RuntimeConflictException("Reset token is expired or already used");
    }

    User user = resetToken.getUser();
    user.setPassword(passwordEncoder.encode(requestDto.getNewPassword()));
    userRepository.save(user);

    resetToken.setUsed(true);
    passwordResetTokenRepository.save(resetToken);

    log.info("Password reset successful for user: {}", user.getEmail());

    return Map.of("message", "Password reset successful");
}
}
