package com.velo.platform.controllers;

import com.velo.platform.dto.PaymentMethodDto;
import com.velo.platform.services.PaymentMethodService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping(path = "/payment-methods")
@Tag(name = "Payment Method", description = "Payment method management")
@SecurityRequirement(name = "bearerAuth")
public class PaymentMethodController {

    private final PaymentMethodService paymentMethodService;

    @GetMapping
    @Operation(summary = "Get all payment methods for current user")
    public ResponseEntity<List<PaymentMethodDto>> getPaymentMethods() {
        return ResponseEntity.ok(paymentMethodService.getPaymentMethods());
    }

    @PostMapping
    @Operation(summary = "Add a new payment method")
    public ResponseEntity<PaymentMethodDto> addPaymentMethod(@Valid @RequestBody PaymentMethodDto paymentMethodDto) {
        return ResponseEntity.ok(paymentMethodService.addPaymentMethod(paymentMethodDto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a payment method")
    public ResponseEntity<Void> deletePaymentMethod(@PathVariable Long id) {
        paymentMethodService.deletePaymentMethod(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/default")
    @Operation(summary = "Set a payment method as default")
    public ResponseEntity<PaymentMethodDto> setDefaultPaymentMethod(@PathVariable Long id) {
        return ResponseEntity.ok(paymentMethodService.setDefaultPaymentMethod(id));
    }
}