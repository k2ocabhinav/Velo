package com.velo.platform.services.impl;

import com.velo.platform.dto.AuthResponseDto;
import com.velo.platform.dto.DriverDto;
import com.velo.platform.dto.SignupDto;
import com.velo.platform.dto.UserDto;
import com.velo.platform.entities.Driver;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DriverOnboardingStatus;
import com.velo.platform.entities.enums.Role;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.PasswordResetTokenRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.JwtTokenProvider;
import com.velo.platform.services.DriverService;
import com.velo.platform.services.RiderService;
import com.velo.platform.services.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private RiderService riderService;

    @Mock
    private WalletService walletService;

    @Mock
    private DriverService driverService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(
                userRepository, passwordResetTokenRepository, modelMapper, riderService, walletService, driverService, passwordEncoder, jwtTokenProvider);
    }

    @Test
    @DisplayName("Signup with new email should create user, rider and wallet")
    void signup_WithNewEmail_ShouldCreateUserRiderAndWallet() {
        SignupDto signupDto = new SignupDto();
        signupDto.setName("John Doe");
        signupDto.setEmail("newuser@test.com");
        signupDto.setPassword("password123");

        User mappedUser = User.builder()
                .email("newuser@test.com")
                .password("password123")
                .firstName("John")
                .lastName("Doe")
                .roles(new HashSet<>())
                .build();

        when(userRepository.findByEmail(signupDto.getEmail())).thenReturn(Optional.empty());
        when(modelMapper.map(signupDto, User.class)).thenReturn(mappedUser);
        when(passwordEncoder.encode(signupDto.getPassword())).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(1L);
            return user;
        });
        when(modelMapper.map(any(User.class), eq(UserDto.class))).thenReturn(new UserDto());

        UserDto result = authService.signup(signupDto);

        assertThat(result).isNotNull();
        verify(userRepository).save(any(User.class));
        verify(riderService).createNewRider(any(User.class));
        verify(walletService).createNewWallet(any(User.class));
        assertThat(mappedUser.getPassword()).isEqualTo("encoded-password");
        assertThat(mappedUser.getActive()).isTrue();
    }

    @Test
    @DisplayName("Signup with existing email should throw RuntimeConflictException")
    void signup_WithExistingEmail_ShouldThrowException() {
        SignupDto signupDto = new SignupDto();
        signupDto.setEmail("existing@test.com");
        signupDto.setPassword("password123");

        User existingUser = User.builder().email("existing@test.com").build();
        when(userRepository.findByEmail(signupDto.getEmail())).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> authService.signup(signupDto))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("User already exists");
    }

    @Test
    @DisplayName("Login with valid credentials should return auth response")
    void login_WithValidCredentials_ShouldReturnAuthResponse() {
        String email = "user@test.com";
        String password = "password123";
        User user = User.builder()
                .id(1L)
                .email(email)
                .password("encoded-password")
                .roles(Set.of(Role.RIDER))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(password, user.getPassword())).thenReturn(true);
        when(jwtTokenProvider.generateToken(email, 1L, Role.RIDER.name())).thenReturn("jwt-token");

        AuthResponseDto result = authService.login(email, password);

        assertThat(result.getToken()).isEqualTo("jwt-token");
        assertThat(result.getUserId()).isEqualTo(1L);
        assertThat(result.getEmail()).isEqualTo(email);
        assertThat(result.getRole()).isEqualTo(Role.RIDER.name());
    }

    @Test
    @DisplayName("Login with invalid password should throw RuntimeConflictException")
    void login_WithInvalidPassword_ShouldThrowException() {
        String email = "user@test.com";
        User user = User.builder()
                .id(1L)
                .email(email)
                .password("encoded-password")
                .roles(Set.of(Role.RIDER))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", user.getPassword())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(email, "wrong-password"))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("Invalid password");
    }

    @Test
    @DisplayName("Onboard new driver for valid user should create driver")
    void onboardNewDriver_ForValidUser_ShouldCreateDriver() {
        Long userId = 1L;
        String vehicleId = "VEH123";

        User user = User.builder()
                .id(userId)
                .email("driver@test.com")
                .roles(new HashSet<>())
                .build();

        Driver driverToSave = Driver.builder()
                .user(user)
                .rating(0.0)
                .vehicleId(vehicleId)
                .available(false)
                .onboardingStatus(DriverOnboardingStatus.PENDING)
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(driverService.createNewDriver(any(Driver.class))).thenAnswer(invocation -> {
            Driver d = invocation.getArgument(0);
            d.setId(1L);
            return d;
        });
        when(modelMapper.map(any(Driver.class), eq(DriverDto.class))).thenReturn(new DriverDto());

        DriverDto result = authService.onboardNewDriver(userId, vehicleId);

        assertThat(result).isNotNull();
        verify(driverService).createNewDriver(any(Driver.class));
        assertThat(user.getRoles()).contains(Role.DRIVER);
    }

    @Test
    @DisplayName("Onboard new driver for non-existent user should throw exception")
    void onboardNewDriver_ForNonExistentUser_ShouldThrowException() {
        Long userId = 999L;
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.onboardNewDriver(userId, "VEH123"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    @DisplayName("Onboard new driver for user who is already a driver should throw exception")
    void onboardNewDriver_ForAlreadyDriver_ShouldThrowException() {
        Long userId = 1L;
        String vehicleId = "VEH123";

        User user = User.builder()
                .id(userId)
                .roles(new HashSet<>(Set.of(Role.DRIVER)))
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.onboardNewDriver(userId, vehicleId))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("already a Driver");
    }
}
