package com.velo.platform.services;

import com.velo.platform.dto.FareEstimateDto;
import com.velo.platform.dto.FareEstimateRequestDto;

public interface FareEstimationService {
    FareEstimateDto estimateFare(FareEstimateRequestDto fareEstimateRequestDto);
}
