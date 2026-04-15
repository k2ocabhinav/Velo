package com.velo.platform.services;

import com.velo.platform.dto.PromoCodeDto;
import com.velo.platform.dto.PromoCodeResultDto;
import com.velo.platform.entities.User;

import java.math.BigDecimal;
import java.util.List;

public interface PromoCodeService {
    PromoCodeDto createPromoCode(PromoCodeDto promoCodeDto);
    PromoCodeDto updatePromoCode(Long id, PromoCodeDto promoCodeDto);
    PromoCodeDto deactivatePromoCode(Long id);
    PromoCodeResultDto previewPromo(String code, User user, BigDecimal originalFare);
    PromoCodeResultDto validateAndApplyPromo(String code, User user, BigDecimal originalFare);
    List<PromoCodeDto> getActivePromoCodes();
    List<PromoCodeDto> getAllPromoCodes();
}
