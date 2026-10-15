package com.velo.platform.dto;

public record GeocodingResultDto(String label, String fullAddress, double lat, double lon, String type) {
}
