package com.velo.platform.services.impl;

import com.velo.platform.dto.PromoCodeDto;
import com.velo.platform.dto.PromoCodeResultDto;
import com.velo.platform.entities.PromoCode;
import com.velo.platform.entities.PromoCodeUsage;
import com.velo.platform.entities.User;
import com.velo.platform.entities.enums.DiscountType;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.exceptions.BadRequestException;
import com.velo.platform.repositories.PromoCodeRepository;
import com.velo.platform.repositories.PromoCodeUsageRepository;
import com.velo.platform.services.TenantScopeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PromoCodeServiceImplTest {

    @Mock
    private PromoCodeRepository promoCodeRepository;

    @Mock
    private PromoCodeUsageRepository promoCodeUsageRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private TenantScopeService tenantScopeService;

    @InjectMocks
    private PromoCodeServiceImpl promoCodeService;

    private PromoCode promoCode;
    private User user;
    private PromoCodeDto promoCodeDto;

    @BeforeEach
    void setUp() {
        lenient().when(tenantScopeService.requireCurrentTenantId()).thenReturn(1L);
        lenient().when(promoCodeRepository.incrementCurrentUsesIfAvailable(anyLong(), eq(1L))).thenReturn(1);
        user = User.builder().id(1L).email("test@example.com").build();
        
        promoCode = PromoCode.builder()
                .id(1L)
                .code("SAVE10")
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(BigDecimal.valueOf(10))
                .active(true)
                .currentUses(0)
                .maxUses(100)
                .minRideFare(BigDecimal.valueOf(50))
                .startDate(LocalDate.now().minusDays(1))
                .endDate(LocalDate.now().plusDays(1))
                .build();

        promoCodeDto = PromoCodeDto.builder()
                .code("SAVE10")
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(BigDecimal.valueOf(10))
                .build();
    }

    @Test
    void createPromoCode_WhenUnique_ShouldSave() {
        when(promoCodeRepository.existsByCode("SAVE10")).thenReturn(false);
        when(modelMapper.map(any(PromoCodeDto.class), eq(PromoCode.class))).thenReturn(promoCode);
        when(promoCodeRepository.save(any(PromoCode.class))).thenReturn(promoCode);
        when(modelMapper.map(any(PromoCode.class), eq(PromoCodeDto.class))).thenReturn(promoCodeDto);

        PromoCodeDto result = promoCodeService.createPromoCode(promoCodeDto);

        assertThat(result).isNotNull();
        assertThat(result.getCode()).isEqualTo("SAVE10");
        verify(promoCodeRepository).save(any());
    }

    @Test
    void createPromoCode_WhenDuplicate_ShouldThrowException() {
        when(promoCodeRepository.existsByCode("SAVE10")).thenReturn(true);

        assertThatThrownBy(() -> promoCodeService.createPromoCode(promoCodeDto))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void createPromoCode_WhenCodeMissing_ShouldThrowBadRequest() {
        promoCodeDto.setCode("  ");

        assertThatThrownBy(() -> promoCodeService.createPromoCode(promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("code is required");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void createPromoCode_WhenDiscountTypeMissing_ShouldThrowBadRequest() {
        promoCodeDto.setDiscountType(null);

        assertThatThrownBy(() -> promoCodeService.createPromoCode(promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Discount type is required");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void createPromoCode_WhenDiscountValueNotPositive_ShouldThrowBadRequest() {
        promoCodeDto.setDiscountValue(BigDecimal.ZERO);

        assertThatThrownBy(() -> promoCodeService.createPromoCode(promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("greater than zero");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void createPromoCode_WhenEndDateBeforeStartDate_ShouldThrowBadRequest() {
        promoCodeDto.setStartDate(LocalDate.of(2026, 12, 1));
        promoCodeDto.setEndDate(LocalDate.of(2026, 11, 1));

        assertThatThrownBy(() -> promoCodeService.createPromoCode(promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("End date");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void updatePromoCode_WhenEndDateBeforeStartDate_ShouldThrowBadRequest() {
        promoCodeDto.setStartDate(LocalDate.of(2026, 12, 1));
        promoCodeDto.setEndDate(LocalDate.of(2026, 11, 1));

        assertThatThrownBy(() -> promoCodeService.updatePromoCode(1L, promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("End date");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void updatePromoCode_WhenMaxUsesIsNegative_ShouldThrowBadRequest() {
        promoCodeDto.setMaxUses(-1);

        assertThatThrownBy(() -> promoCodeService.updatePromoCode(1L, promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Maximum uses");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void updatePromoCode_WhenDiscountIsNonPositive_ShouldThrowBadRequest() {
        promoCodeDto.setDiscountValue(BigDecimal.ZERO);

        assertThatThrownBy(() -> promoCodeService.updatePromoCode(1L, promoCodeDto))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("greater than zero");

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void validateAndApplyPromo_WithFlatDiscount_ShouldReturnDiscount() {
        promoCode.setDiscountType(DiscountType.FLAT);
        promoCode.setDiscountValue(BigDecimal.valueOf(20));

        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));
        when(promoCodeUsageRepository.existsByPromoCodeAndUser(promoCode, user)).thenReturn(false);

        PromoCodeResultDto result = promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100));

        assertThat(result.isValid()).isTrue();
        assertThat(result.getDiscountAmount()).isEqualByComparingTo(BigDecimal.valueOf(20));
        assertThat(result.getDiscountedFare()).isEqualByComparingTo(BigDecimal.valueOf(80));
        verify(promoCodeUsageRepository).save(any(PromoCodeUsage.class));
        verify(promoCodeRepository).incrementCurrentUsesIfAvailable(1L, 1L);
        verify(promoCodeRepository, never()).save(promoCode);
    }

    @Test
    void validateAndApplyPromo_WithPercentageDiscount_ShouldReturnDiscount() {
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));
        when(promoCodeUsageRepository.existsByPromoCodeAndUser(promoCode, user)).thenReturn(false);

        PromoCodeResultDto result = promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100));

        assertThat(result.isValid()).isTrue();
        assertThat(result.getDiscountAmount()).isEqualByComparingTo(BigDecimal.valueOf(10));
        assertThat(result.getDiscountedFare()).isEqualByComparingTo(BigDecimal.valueOf(90));
    }

    @Test
    void validateAndApplyPromo_WhenExpired_ShouldThrowException() {
        promoCode.setEndDate(LocalDate.now().minusDays(1));
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void validateAndApplyPromo_WhenInactive_ShouldThrowException() {
        promoCode.setActive(false);
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("inactive");
    }

    @Test
    void validateAndApplyPromo_WhenOverLimit_ShouldThrowException() {
        promoCode.setMaxUses(5);
        promoCode.setCurrentUses(5);
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("limit reached");
    }

    @Test
    void validateAndApplyPromo_WhenFareTooLow_ShouldThrowException() {
        promoCode.setMinRideFare(BigDecimal.valueOf(200));
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("minimum requirement");
    }

    @Test
    void validateAndApplyPromo_WhenAlreadyUsed_ShouldThrowException() {
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));
        when(promoCodeUsageRepository.existsByPromoCodeAndUser(promoCode, user)).thenReturn(true);

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo("SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("already used");
    }

    @Test
    void deactivatePromoCode_ShouldSetInactive() {
        when(promoCodeRepository.findByIdAndTenantId(1L, 1L)).thenReturn(Optional.of(promoCode));
        when(promoCodeRepository.save(any(PromoCode.class))).thenReturn(promoCode);
        when(modelMapper.map(any(PromoCode.class), eq(PromoCodeDto.class))).thenReturn(promoCodeDto);

        PromoCodeDto result = promoCodeService.deactivatePromoCode(1L);

        assertThat(promoCode.getActive()).isFalse();
        verify(promoCodeRepository).save(promoCode);
    }

    @Test
    void validateAndApplyPromo_WhenConcurrentUsesExhaustLimit_ShouldReject() {
        promoCode.setCurrentUses(4);
        promoCode.setMaxUses(5);
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));
        when(promoCodeUsageRepository.existsByPromoCodeAndUser(promoCode, user)).thenReturn(false);
        when(promoCodeRepository.incrementCurrentUsesIfAvailable(1L, 1L)).thenReturn(0);

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo(
                "SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("limit reached");

        verify(promoCodeUsageRepository).save(any(PromoCodeUsage.class));
        verify(promoCodeRepository).incrementCurrentUsesIfAvailable(1L, 1L);
    }

    @Test
    void validateAndApplyPromo_WhenUniqueUsageConstraintWinsRace_ShouldReturnConflict() {
        when(promoCodeRepository.findByCodeAndTenantId("SAVE10", 1L)).thenReturn(Optional.of(promoCode));
        when(promoCodeUsageRepository.existsByPromoCodeAndUser(promoCode, user)).thenReturn(false);
        when(promoCodeUsageRepository.save(any(PromoCodeUsage.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate usage"));

        assertThatThrownBy(() -> promoCodeService.validateAndApplyPromo(
                "SAVE10", user, BigDecimal.valueOf(100)))
                .isInstanceOf(RuntimeConflictException.class)
                .hasMessageContaining("already used");

        verify(promoCodeRepository, never()).incrementCurrentUsesIfAvailable(anyLong(), eq(1L));
    }

    @Test
    void updatePromoCode_CrossTenantCode_ShouldReturnNotFound() {
        when(promoCodeRepository.findByIdAndTenantId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> promoCodeService.updatePromoCode(1L, promoCodeDto))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getAllPromoCodes_ShouldOnlyQueryCurrentTenant() {
        when(promoCodeRepository.findByTenantId(1L)).thenReturn(List.of(promoCode));
        when(modelMapper.map(promoCode, PromoCodeDto.class)).thenReturn(promoCodeDto);

        assertThat(promoCodeService.getAllPromoCodes()).containsExactly(promoCodeDto);

        verify(promoCodeRepository).findByTenantId(1L);
    }
}
