package com.velo.platform.services;

import com.velo.platform.dto.RecurringTripTemplateDto;
import com.velo.platform.dto.RecurringTripTemplateRequestDto;
import com.velo.platform.dto.admin.TripSheetRiderOptionDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface RecurringTripTemplateService {
    Page<RecurringTripTemplateDto> getTenantTemplates(Pageable pageable);
    Page<RecurringTripTemplateDto> getMyTemplates(Pageable pageable);
    List<TripSheetRiderOptionDto> getTenantRiders();
    RecurringTripTemplateDto createForTenant(RecurringTripTemplateRequestDto request);
    RecurringTripTemplateDto createForCurrentRider(RecurringTripTemplateRequestDto request);
    RecurringTripTemplateDto updateForTenant(Long id, RecurringTripTemplateRequestDto request);
    RecurringTripTemplateDto updateForCurrentRider(Long id, RecurringTripTemplateRequestDto request);
    RecurringTripTemplateDto setTenantTemplateActive(Long id, boolean active);
    RecurringTripTemplateDto setMyTemplateActive(Long id, boolean active);
    void deleteTenantTemplate(Long id);
    void deleteMyTemplate(Long id);
    int materializeOccurrences();
}
