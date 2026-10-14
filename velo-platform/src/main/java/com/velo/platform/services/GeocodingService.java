package com.velo.platform.services;

import com.velo.platform.dto.GeocodingResultDto;

import java.util.List;

public interface GeocodingService {
    List<GeocodingResultDto> search(String query, String near);

    GeocodingResultDto reverse(double latitude, double longitude);
}
