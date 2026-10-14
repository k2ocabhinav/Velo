package com.velo.platform.exceptions;

public class GeocodingUnavailableException extends RuntimeException {
    public GeocodingUnavailableException() {
        super("The address service is temporarily unavailable. Please try again.");
    }

    public GeocodingUnavailableException(Throwable cause) {
        super("The address service is temporarily unavailable. Please try again.", cause);
    }
}
