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
import com.velo.platform.entities.enums.DriverOnboardingStatus;
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
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    private static final Long DEFAULT_TENANT_ID = 1L;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final ModelMapper modelMapper;
    private final RiderService riderService;
    private final WalletService walletService;
    private final DriverService driverService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional(readOnly = true)
    public AuthResponseDto login(String email, String password) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String role;
        if (user.getRoles().contains(Role.ADMIN)) {
            role = Role.ADMIN.name();
        } else if (user.getRoles().contains(DRIVER)) {
            role = DRIVER.name();
        } else {
            role = Role.RIDER.name();
        }
        Long tenantId = user.getTenantId() == null ? DEFAULT_TENANT_ID : user.getTenantId();
        String token = jwtTokenProvider.generateToken(user.getEmail(), user.getId(), role, tenantId);

        return AuthResponseDto.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .role(role)
                .tenantId(tenantId)
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
        mappedUser.setTenantId(DEFAULT_TENANT_ID);

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
        UserPrincipal caller = currentUserPrincipal();
        boolean selfOnboarding = caller.getUserId().equals(userId);
        boolean sameTenantAdmin = Role.ADMIN.name().equals(caller.getRole());
        if (!selfOnboarding && !sameTenantAdmin) {
            throw new AccessDeniedException("You may only onboard yourself or users in your tenant");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id "+userId));

        if (!selfOnboarding && !effectiveTenantId(caller.getTenantId()).equals(effectiveTenantId(user.getTenantId()))) {
            throw new ResourceNotFoundException("User not found with id " + userId);
        }

        if(user.getRoles().contains(DRIVER))
            throw new RuntimeConflictException("User with id "+userId+" is already a Driver");

        Driver createDriver = Driver.builder()
                .user(user)
                .tenantId(user.getTenantId() == null ? DEFAULT_TENANT_ID : user.getTenantId())
                .rating(0.0)
                .vehicleId(vehicleId)
                .available(false)
                .onboardingStatus(DriverOnboardingStatus.PENDING)
                .build();
user.getRoles().add(DRIVER);
    userRepository.save(user);
    Driver savedDriver = driverService.createNewDriver(createDriver);
    return modelMapper.map(savedDriver, DriverDto.class);
}

private UserPrincipal currentUserPrincipal() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
        throw new AccessDeniedException("Authentication is required");
    }
    return principal;
}

private Long effectiveTenantId(Long tenantId) {
    return tenantId == null ? DEFAULT_TENANT_ID : tenantId;
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
@Transactional
public Map<String, String> forgotPassword(ForgotPasswordRequestDto requestDto) {
    User user = userRepository.findByEmail(requestDto.getEmail()).orElse(null);
    if (user == null) {
        return Map.of("message", "If an account exists with this email, a password reset link has been sent");
    }

    String token = UUID.randomUUID().toString();
    PasswordResetToken resetToken = PasswordResetToken.builder()
            .token(token)
            .user(user)
            .expiryDate(LocalDateTime.now().plusHours(24))
            .used(false)
            .build();

    passwordResetTokenRepository.save(resetToken);

    log.info("Password reset requested for user id: {}", user.getId());

    return Map.of(
            "message", "If an account exists with this email, a password reset link has been sent"
    );
}

@Override
@Transactional
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
