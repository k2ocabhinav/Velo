package com.velo.platform.configs;

import java.util.TimeZone;

public final class UtcTimeZone {

    private UtcTimeZone() { }

    public static void setDefault() {
        System.setProperty("user.timezone", "UTC");
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }
}
