package com.velo.platform.utils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Utilities for the backend's UTC wall-clock time model. */
public final class UtcTimes {

    private UtcTimes() { }

    public static LocalDateTime now() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    public static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    public static LocalTime timeOfDay() {
        return LocalTime.now(ZoneOffset.UTC);
    }

    public static OffsetDateTime toOffsetDateTime(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }
}
