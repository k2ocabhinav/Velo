package com.velo.platform.utils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Converts database timestamps stored as UTC wall time into explicit UTC instants. */
public final class UtcTimes {

    private UtcTimes() { }

    public static OffsetDateTime toOffsetDateTime(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }
}
