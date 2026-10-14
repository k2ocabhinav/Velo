package com.velo.platform.dto;

import com.velo.platform.entities.enums.PaymentMethod;
import lombok.Builder;
import lombok.Value;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

@Value
@Builder
public class RecurringTripTemplateDto {
    Long id;
    Long riderId;
    String riderName;
    Set<DayOfWeek> daysOfWeek;
    LocalTime localTime;
    LocalDate startDate;
    LocalDate endDate;
    PointDto pickupLocation;
    PointDto dropOffLocation;
    String pickupAddress;
    String dropOffAddress;
    PaymentMethod paymentMethod;
    String notes;
    String bookingReference;
    boolean active;
}
