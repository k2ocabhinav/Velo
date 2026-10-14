package com.velo.platform.services.impl;

import com.velo.platform.dto.PromoCodeDto;
import com.velo.platform.dto.PromoCodeResultDto;
import com.velo.platform.entities.PromoCode;
import com.velo.platform.entities.PromoCodeUsage;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DiscountType;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.PromoCodeRepository;
import com.velo.platform.repositories.PromoCodeUsageRepository;
import com.velo.platform.services.PromoCodeService;
import com.velo.platform.services.TenantScopeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromoCodeServiceImpl implements PromoCodeService {

    private final PromoCodeRepository promoCodeRepository;
    private final PromoCodeUsageRepository promoCodeUsageRepository;
    private final ModelMapper modelMapper;
    private final TenantScopeService tenantScopeService;

    @Override
    @Transactional
    public PromoCodeDto createPromoCode(PromoCodeDto promoCodeDto) {
        Long tenantId = currentTenantId();
        // The schema keeps promo codes globally unique, so check that same key before insert.
        if (promoCodeRepository.existsByCode(promoCodeDto.getCode())) {
            throw new RuntimeConflictException("Promo code already exists: " + promoCodeDto.getCode());
        }

        PromoCode promoCode = modelMapper.map(promoCodeDto, PromoCode.class);
        promoCode.setTenantId(tenantId);
        promoCode.setCurrentUses(0);
        
        PromoCode saved = promoCodeRepository.save(promoCode);
        log.info("Created new promo code: {}", saved.getCode());
        return modelMapper.map(saved, PromoCodeDto.class);
    }

    @Override
    @Transactional
    public PromoCodeDto updatePromoCode(Long id, PromoCodeDto promoCodeDto) {
        PromoCode existing = getPromoCodeEntity(id);

        // Update fields that are allowed to change
        existing.setDescription(promoCodeDto.getDescription());
        existing.setStartDate(promoCodeDto.getStartDate());
        existing.setEndDate(promoCodeDto.getEndDate());
        existing.setMaxUses(promoCodeDto.getMaxUses());
        existing.setMinRideFare(promoCodeDto.getMinRideFare());
        if (promoCodeDto.getActive() != null) {
            existing.setActive(promoCodeDto.getActive());
        }

        PromoCode saved = promoCodeRepository.save(existing);
        log.info("Updated promo code id: {}", id);
        return modelMapper.map(saved, PromoCodeDto.class);
    }

    @Override
    @Transactional
    public PromoCodeDto deactivatePromoCode(Long id) {
        PromoCode existing = getPromoCodeEntity(id);
        existing.setActive(false);
        PromoCode saved = promoCodeRepository.save(existing);
        log.info("Deactivated promo code id: {}", id);
        return modelMapper.map(saved, PromoCodeDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public PromoCodeResultDto previewPromo(String code, User user, BigDecimal originalFare) {
        return evaluatePromo(code, user, originalFare, false);
    }

    @Override
    @Transactional
    public PromoCodeResultDto validateAndApplyPromo(String code, User user, BigDecimal originalFare) {
        return evaluatePromo(code, user, originalFare, true);
    }

    private PromoCodeResultDto evaluatePromo(String code, User user, BigDecimal originalFare, boolean persistUsage) {
        if (code == null || code.trim().isEmpty()) {
            return PromoCodeResultDto.builder().valid(false).message("No promo code provided").build();
        }

        Long tenantId = resolveTenantId(user.getTenantId());
        PromoCode promoCode = promoCodeRepository.findByCodeAndTenantId(code, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Promo code not found: " + code));

        if (!promoCode.getActive()) {
            throw new RuntimeConflictException("Promo code is inactive");
        }

        LocalDate now = LocalDate.now();
        if (promoCode.getStartDate() != null && now.isBefore(promoCode.getStartDate())) {
            throw new RuntimeConflictException("Promo code is not yet valid");
        }
        if (promoCode.getEndDate() != null && now.isAfter(promoCode.getEndDate())) {
            throw new RuntimeConflictException("Promo code has expired");
        }

        if (promoCode.getMaxUses() != null && promoCode.getCurrentUses() >= promoCode.getMaxUses()) {
            throw new RuntimeConflictException("Promo code usage limit reached");
        }

        if (promoCode.getMinRideFare() != null && originalFare.compareTo(promoCode.getMinRideFare()) < 0) {
            throw new RuntimeConflictException("Ride fare does not meet minimum requirement for promo code");
        }

        if (promoCodeUsageRepository.existsByPromoCodeAndUser(promoCode, user)) {
            throw new RuntimeConflictException("You have already used this promo code");
        }

        BigDecimal discountAmount;
        if (promoCode.getDiscountType() == DiscountType.FLAT) {
            discountAmount = promoCode.getDiscountValue();
        } else {
            // Percentage discount
            discountAmount = originalFare.multiply(promoCode.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }

        // Ensure discount doesn't exceed original fare
        if (discountAmount.compareTo(originalFare) > 0) {
            discountAmount = originalFare;
        }

        BigDecimal discountedFare = originalFare.subtract(discountAmount);

        if (persistUsage) {
            PromoCodeUsage usage = PromoCodeUsage.builder()
                    .tenantId(user.getTenantId() == null ? 1L : user.getTenantId())
                    .promoCode(promoCode)
                    .user(user)
                    .discountApplied(discountAmount)
                    .usedAt(LocalDateTime.now())
                    .build();
            try {
                promoCodeUsageRepository.save(usage);
                int incremented = promoCodeRepository.incrementCurrentUsesIfAvailable(promoCode.getId(), tenantId);
                if (incremented == 0) {
                    throw new RuntimeConflictException("Promo code usage limit reached");
                }
            } catch (DataIntegrityViolationException exception) {
                throw new RuntimeConflictException("You have already used this promo code");
            }

            log.info("Applied promo code {} for user {}, discount: {}", code, user.getId(), discountAmount);
        }

        return PromoCodeResultDto.builder()
                .valid(true)
                .discountAmount(discountAmount)
                .originalFare(originalFare)
                .discountedFare(discountedFare)
                .message(persistUsage ? "Promo code applied successfully" : "Promo code is valid")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PromoCodeDto> getActivePromoCodes() {
        return promoCodeRepository.findByTenantIdAndActiveTrue(currentTenantId()).stream()
                .filter(p -> p.getEndDate() == null || !LocalDate.now().isAfter(p.getEndDate()))
                .map(p -> modelMapper.map(p, PromoCodeDto.class))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<PromoCodeDto> getAllPromoCodes() {
        return promoCodeRepository.findByTenantId(currentTenantId()).stream()
                .map(p -> modelMapper.map(p, PromoCodeDto.class))
                .collect(Collectors.toList());
    }

    private PromoCode getPromoCodeEntity(Long id) {
        return promoCodeRepository.findByIdAndTenantId(id, currentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Promo code not found with id: " + id));
    }

    private Long currentTenantId() {
        return tenantScopeService.requireCurrentTenantId();
    }

    private Long resolveTenantId(Long tenantId) {
        return tenantId == null ? 1L : tenantId;
    }
}
