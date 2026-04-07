package com.velo.platform.services.impl;

import com.velo.platform.dto.PaymentMethodDto;
import com.velo.platform.entities.PaymentMethodEntity;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.PaymentMethodType;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.PaymentMethodRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentMethodServiceImplTest {

    @Mock
    private PaymentMethodRepository paymentMethodRepository;

    @Mock
    private UserRepository userRepository;

    private PaymentMethodServiceImpl paymentMethodService;

    private User testUser;

    @BeforeEach
    void setUp() {
        paymentMethodService = new PaymentMethodServiceImpl(paymentMethodRepository, userRepository);
        testUser = User.builder().id(1L).email("test@test.com").build();
    }

    private void setUpSecurityContext(Long userId) {
        UserPrincipal userPrincipal = UserPrincipal.builder()
                .userId(userId)
                .email("test@test.com")
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userPrincipal, null, List.of()));
    }

    @Test
    @DisplayName("getPaymentMethods should return list of payment methods for current user")
    void getPaymentMethods_ShouldReturnPaymentMethods() {
        setUpSecurityContext(1L);

        List<PaymentMethodEntity> paymentMethods = List.of(
                PaymentMethodEntity.builder().id(1L).type(PaymentMethodType.CARD).lastFourDigits("1234").isDefault(true).user(testUser).build(),
                PaymentMethodEntity.builder().id(2L).type(PaymentMethodType.WALLET).lastFourDigits(null).isDefault(false).user(testUser).build()
        );

        when(paymentMethodRepository.findByUserId(1L)).thenReturn(paymentMethods);

        List<PaymentMethodDto> result = paymentMethodService.getPaymentMethods();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getType()).isEqualTo(PaymentMethodType.CARD);
        assertThat(result.get(0).getLastFourDigits()).isEqualTo("1234");
        assertThat(result.get(1).getType()).isEqualTo(PaymentMethodType.WALLET);
    }

    @Test
    @DisplayName("addPaymentMethod should create new payment method")
    void addPaymentMethod_ShouldCreatePaymentMethod() {
        setUpSecurityContext(1L);

        PaymentMethodDto dto = PaymentMethodDto.builder()
                .type(PaymentMethodType.CARD)
                .lastFourDigits("5678")
                .expiryDate("12/26")
                .isDefault(true)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(paymentMethodRepository.save(any(PaymentMethodEntity.class))).thenAnswer(invocation -> {
            PaymentMethodEntity entity = invocation.getArgument(0);
            entity.setId(1L);
            return entity;
        });

        PaymentMethodDto result = paymentMethodService.addPaymentMethod(dto);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getType()).isEqualTo(PaymentMethodType.CARD);
        assertThat(result.getLastFourDigits()).isEqualTo("5678");

        verify(paymentMethodRepository).save(any(PaymentMethodEntity.class));
    }

    @Test
    @DisplayName("addPaymentMethod with default true should clear other defaults")
    void addPaymentMethod_WithDefaultTrue_ShouldClearOtherDefaults() {
        setUpSecurityContext(1L);

        PaymentMethodDto dto = PaymentMethodDto.builder()
                .type(PaymentMethodType.CARD)
                .lastFourDigits("9999")
                .isDefault(true)
                .build();

        PaymentMethodEntity existingDefault = PaymentMethodEntity.builder()
                .id(1L)
                .isDefault(true)
                .user(testUser)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(paymentMethodRepository.findByUserAndIsDefaultTrue(testUser)).thenReturn(List.of(existingDefault));
        when(paymentMethodRepository.save(any(PaymentMethodEntity.class))).thenAnswer(inv -> {
            PaymentMethodEntity e = inv.getArgument(0);
            e.setId(2L);
            return e;
        });

        paymentMethodService.addPaymentMethod(dto);

        verify(paymentMethodRepository, times(2)).save(any(PaymentMethodEntity.class));
    }

    @Test
    @DisplayName("deletePaymentMethod should delete payment method and set new default if was default")
    void deletePaymentMethod_ShouldDeleteAndSetNewDefault() {
        setUpSecurityContext(1L);

        PaymentMethodEntity paymentMethod = PaymentMethodEntity.builder()
                .id(1L)
                .type(PaymentMethodType.CARD)
                .isDefault(true)
                .user(testUser)
                .build();

        PaymentMethodEntity remainingMethod = PaymentMethodEntity.builder()
                .id(2L)
                .type(PaymentMethodType.WALLET)
                .isDefault(false)
                .user(testUser)
                .build();

        when(paymentMethodRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(paymentMethod));
        when(paymentMethodRepository.findByUser(testUser)).thenReturn(List.of(remainingMethod));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(paymentMethodRepository.save(any(PaymentMethodEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        paymentMethodService.deletePaymentMethod(1L);

        verify(paymentMethodRepository).delete(paymentMethod);
        assertThat(remainingMethod.getIsDefault()).isTrue();
    }

    @Test
    @DisplayName("deletePaymentMethod for non-existent should throw ResourceNotFoundException")
    void deletePaymentMethod_NonExistent_ShouldThrowException() {
        setUpSecurityContext(1L);

        when(paymentMethodRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentMethodService.deletePaymentMethod(1L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Payment method not found");
    }

    @Test
    @DisplayName("setDefaultPaymentMethod should set payment method as default")
    void setDefaultPaymentMethod_ShouldSetDefault() {
        setUpSecurityContext(1L);

        PaymentMethodEntity paymentMethod = PaymentMethodEntity.builder()
                .id(1L)
                .type(PaymentMethodType.CARD)
                .isDefault(false)
                .user(testUser)
                .build();

        when(paymentMethodRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(paymentMethod));
        when(paymentMethodRepository.findByUserAndIsDefaultTrue(testUser)).thenReturn(List.of());
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(paymentMethodRepository.save(any(PaymentMethodEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentMethodDto result = paymentMethodService.setDefaultPaymentMethod(1L);

        assertThat(result.getIsDefault()).isTrue();
    }

    @Test
    @DisplayName("setDefaultPaymentMethod for non-existent should throw ResourceNotFoundException")
    void setDefaultPaymentMethod_NonExistent_ShouldThrowException() {
        setUpSecurityContext(1L);

        when(paymentMethodRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentMethodService.setDefaultPaymentMethod(1L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Payment method not found");
    }
}