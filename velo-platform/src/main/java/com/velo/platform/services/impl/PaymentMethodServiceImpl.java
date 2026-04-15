package com.velo.platform.services.impl;

import com.velo.platform.dto.PaymentMethodDto;
import com.velo.platform.entities.PaymentMethodEntity;
import com.velo.platform.entities.User;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.repositories.PaymentMethodRepository;
import com.velo.platform.repositories.UserRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.PaymentMethodService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentMethodServiceImpl implements PaymentMethodService {

    private final PaymentMethodRepository paymentMethodRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public List<PaymentMethodDto> getPaymentMethods() {
        UserPrincipal principal = getCurrentPrincipal();
        Long userId = principal.getUserId();
        log.info("Getting payment methods for user: {}", userId);
        
        List<PaymentMethodEntity> paymentMethods = paymentMethodRepository.findByUserId(userId);
        return paymentMethods.stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PaymentMethodDto addPaymentMethod(PaymentMethodDto dto) {
        UserPrincipal principal = getCurrentPrincipal();
        Long userId = principal.getUserId();
        log.info("Adding payment method for user: {}", userId);
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!resolveTenantId(user.getTenantId()).equals(resolveTenantId(principal.getTenantId()))) {
            throw new ResourceNotFoundException("User not found");
        }
        
        PaymentMethodEntity paymentMethod = PaymentMethodEntity.builder()
                .tenantId(user.getTenantId())
                .type(dto.getType())
                .lastFourDigits(dto.getLastFourDigits())
                .expiryDate(dto.getExpiryDate())
                .isDefault(dto.getIsDefault() != null ? dto.getIsDefault() : false)
                .user(user)
                .build();
        
        if (Boolean.TRUE.equals(dto.getIsDefault())) {
            clearDefaultPaymentMethods(userId);
        }
        
        PaymentMethodEntity saved = paymentMethodRepository.save(paymentMethod);
        log.info("Added payment method with id: {}", saved.getId());
        
        return mapToDto(saved);
    }

    @Override
    @Transactional
    public void deletePaymentMethod(Long id) {
        Long userId = getCurrentPrincipal().getUserId();
        log.info("Deleting payment method {} for user: {}", id, userId);
        
        PaymentMethodEntity paymentMethod = paymentMethodRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment method not found"));
        
        boolean wasDefault = paymentMethod.getIsDefault();
        paymentMethodRepository.delete(paymentMethod);
        
        if (wasDefault) {
            setNewDefaultPaymentMethod(userId);
        }
        
        log.info("Deleted payment method: {}", id);
    }

    @Override
    @Transactional
    public PaymentMethodDto setDefaultPaymentMethod(Long id) {
        Long userId = getCurrentPrincipal().getUserId();
        log.info("Setting default payment method {} for user: {}", id, userId);
        
        PaymentMethodEntity paymentMethod = paymentMethodRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment method not found"));
        
        clearDefaultPaymentMethods(userId);
        
        paymentMethod.setIsDefault(true);
        PaymentMethodEntity saved = paymentMethodRepository.save(paymentMethod);
        
        log.info("Set default payment method: {}", id);
        
        return mapToDto(saved);
    }

    private UserPrincipal getCurrentPrincipal() {
        return (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private void clearDefaultPaymentMethods(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        List<PaymentMethodEntity> defaultMethods = paymentMethodRepository.findByUserAndIsDefaultTrue(user);
        for (PaymentMethodEntity pm : defaultMethods) {
            pm.setIsDefault(false);
            paymentMethodRepository.save(pm);
        }
    }

    private void setNewDefaultPaymentMethod(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        paymentMethodRepository.findByUser(user).stream()
                .findFirst()
                .ifPresent(pm -> {
                    pm.setIsDefault(true);
                    paymentMethodRepository.save(pm);
                });
    }

    private PaymentMethodDto mapToDto(PaymentMethodEntity entity) {
        return PaymentMethodDto.builder()
                .id(entity.getId())
                .type(entity.getType())
                .lastFourDigits(entity.getLastFourDigits())
                .expiryDate(entity.getExpiryDate())
                .isDefault(entity.getIsDefault())
                .build();
    }

    private Long resolveTenantId(Long tenantId) {
        return tenantId == null ? 1L : tenantId;
    }
}
