package com.velo.platform.services.impl;

import com.velo.platform.dto.PromoCodeDto;
import com.velo.platform.exceptions.BadRequestException;

import java.math.BigDecimal;

/** Shared business invariants for creating and updating a promo code. */
final class PromoCodeValidator {

    private PromoCodeValidator() { }

    static void validate(PromoCodeDto request) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            throw new BadRequestException("Promo code is required");
        }
        if (request.getDiscountType() == null) {
            throw new BadRequestException("Discount type is required");
        }
        if (request.getDiscountValue() == null || request.getDiscountValue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Discount value must be greater than zero");
        }
        if (request.getMaxUses() != null && request.getMaxUses() < 0) {
            throw new BadRequestException("Maximum uses cannot be negative");
        }
        if (request.getStartDate() != null && request.getEndDate() != null
                && request.getEndDate().isBefore(request.getStartDate())) {
            throw new BadRequestException("End date must not be before start date");
        }
    }
}
