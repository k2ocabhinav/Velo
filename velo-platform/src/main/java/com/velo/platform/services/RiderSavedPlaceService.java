package com.velo.platform.services;

import com.velo.platform.dto.RiderSavedPlaceDto;
import com.velo.platform.dto.RiderSavedPlaceMutationDto;

import java.util.List;

public interface RiderSavedPlaceService {
    List<RiderSavedPlaceDto> listSavedPlaces();

    RiderSavedPlaceDto createSavedPlace(RiderSavedPlaceMutationDto request);

    RiderSavedPlaceDto updateSavedPlace(Long id, RiderSavedPlaceMutationDto request);

    void deleteSavedPlace(Long id);
}
