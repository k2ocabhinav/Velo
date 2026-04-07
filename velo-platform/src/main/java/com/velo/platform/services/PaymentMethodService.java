package com.velo.platform.services;

import com.velo.platform.dto.PaymentMethodDto;

import java.util.List;

public interface PaymentMethodService {
    List<PaymentMethodDto> getPaymentMethods();

    PaymentMethodDto addPaymentMethod(PaymentMethodDto dto);

    void deletePaymentMethod(Long id);

    PaymentMethodDto setDefaultPaymentMethod(Long id);
}
