package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

@Data
public class RecurringTripTemplateRequestDto {
    private Long riderId;

    @NotEmpty
    private Set<DayOfWeek> daysOfWeek;

    @NotNull
    private LocalTime localTime;

    @NotNull
    private LocalDate startDate;

    @NotNull
    private LocalDate endDate;

    @NotNull
    @Valid
    private PointDto pickupLocation;

    @NotNull
    @Valid
    private PointDto dropOffLocation;

    @Size(max = 1024)
    private String pickupAddress;

    @Size(max = 1024)
    private String dropOffAddress;

    @NotNull
    private PaymentMethod paymentMethod;

    @Size(max = 1024)
    private String notes;

    @Size(max = 255)
    private String bookingReference;
}
