package com.velo.platform.dto.validation;

import com.velo.platform.dto.PromoCodeDto;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public final class PromoCodeDatesValidator implements ConstraintValidator<ValidPromoCodeDates, PromoCodeDto> {

    @Override
    public boolean isValid(PromoCodeDto value, ConstraintValidatorContext context) {
        return value == null || value.getStartDate() == null || value.getEndDate() == null
                || !value.getEndDate().isBefore(value.getStartDate());
    }
}
