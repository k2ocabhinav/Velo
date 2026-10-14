package com.velo.platform.services.impl;

import com.velo.platform.dto.RiderSavedPlaceDto;
import com.velo.platform.dto.RiderSavedPlaceMutationDto;
import com.velo.platform.entities.RiderSavedPlace;
import com.velo.platform.exceptions.ResourceNotFoundException;
import com.velo.platform.exceptions.RuntimeConflictException;
import com.velo.platform.repositories.RiderSavedPlaceRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.RiderSavedPlaceService;
import com.velo.platform.services.TenantScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RiderSavedPlaceServiceImpl implements RiderSavedPlaceService {
    private final RiderSavedPlaceRepository repository;
    private final TenantScopeService tenantScopeService;

    @Override
    @Transactional(readOnly = true)
    public List<RiderSavedPlaceDto> listSavedPlaces() {
        UserPrincipal principal = currentPrincipal();
        return repository.findAllByTenantIdAndUserIdOrderByCreatedAtDescIdDesc(
                        tenantScopeService.requireCurrentTenantId(), principal.getUserId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public RiderSavedPlaceDto createSavedPlace(RiderSavedPlaceMutationDto request) {
        UserPrincipal principal = currentPrincipal();
        RiderSavedPlace place = RiderSavedPlace.builder()
                .tenantId(tenantScopeService.requireCurrentTenantId())
                .userId(principal.getUserId())
                .name(normalize(request.getName()))
                .label(normalize(request.getLabel()))
                .latitude(request.getLat())
                .longitude(request.getLon())
                .type(normalizeType(request.getType()))
                .build();
        return toDto(repository.save(place));
    }

    @Override
    @Transactional
    public RiderSavedPlaceDto updateSavedPlace(Long id, RiderSavedPlaceMutationDto request) {
        UserPrincipal principal = currentPrincipal();
        RiderSavedPlace place = findOwned(id, tenantScopeService.requireCurrentTenantId(), principal.getUserId());
        place.setName(normalize(request.getName()));
        place.setLabel(normalize(request.getLabel()));
        place.setLatitude(request.getLat());
        place.setLongitude(request.getLon());
        place.setType(normalizeType(request.getType()));
        return toDto(repository.save(place));
    }

    @Override
    @Transactional
    public void deleteSavedPlace(Long id) {
        UserPrincipal principal = currentPrincipal();
        RiderSavedPlace place = findOwned(id, tenantScopeService.requireCurrentTenantId(), principal.getUserId());
        repository.delete(place);
    }

    private RiderSavedPlace findOwned(Long id, Long tenantId, Long userId) {
        return repository.findByIdAndTenantIdAndUserId(id, tenantId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved place not found"));
    }

    private UserPrincipal currentPrincipal() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null
                ? null
                : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserPrincipal userPrincipal) || userPrincipal.getUserId() == null) {
            throw new RuntimeConflictException("Unable to resolve current rider for saved places.");
        }
        return userPrincipal;
    }

    private RiderSavedPlaceDto toDto(RiderSavedPlace place) {
        return RiderSavedPlaceDto.builder()
                .id(place.getId())
                .name(place.getName())
                .label(place.getLabel())
                .lat(place.getLatitude())
                .lon(place.getLongitude())
                .type(place.getType())
                .build();
    }

    private String normalize(String value) {
        return value.trim();
    }

    private String normalizeType(String value) {
        return value == null || value.isBlank() ? "saved" : value.trim();
    }
}
