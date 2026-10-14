package com.velo.platform.services.impl;

import com.velo.platform.entities.RiderSavedPlace;
import com.velo.platform.repositories.RiderSavedPlaceRepository;
import com.velo.platform.security.UserPrincipal;
import com.velo.platform.services.TenantScopeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class RiderSavedPlaceServiceImplTest {
    @Mock private RiderSavedPlaceRepository repository;
    @Mock private TenantScopeService tenantScopeService;
    @InjectMocks private RiderSavedPlaceServiceImpl service;

    @BeforeEach
    void setUp() {
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(42L);
        UserPrincipal principal = UserPrincipal.builder()
                .userId(9001L)
                .email("rider@example.test")
                .role("RIDER")
                .tenantId(42L)
                .build();
        var securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(new UsernamePasswordAuthenticationToken(principal, "token"));
        SecurityContextHolder.setContext(securityContext);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listAlwaysScopesByCurrentTenantAndUser() {
        RiderSavedPlace place = place(7L, "Home");
        when(repository.findAllByTenantIdAndUserIdOrderByCreatedAtDescIdDesc(42L, 9001L)).thenReturn(List.of(place));

        assertThat(service.listSavedPlaces()).extracting("name").containsExactly("Home");
        verify(repository).findAllByTenantIdAndUserIdOrderByCreatedAtDescIdDesc(42L, 9001L);
    }

    @Test
    void createUsesIdentityAndTenantFromAuthenticatedPrincipal() {
        when(repository.save(any(RiderSavedPlace.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var request = new com.velo.platform.dto.RiderSavedPlaceMutationDto();
        request.setName("  Home  ");
        request.setLabel("  Home, Bengaluru  ");
        request.setLat(12.9);
        request.setLon(77.5);

        service.createSavedPlace(request);

        ArgumentCaptor<RiderSavedPlace> captor = ArgumentCaptor.forClass(RiderSavedPlace.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getTenantId()).isEqualTo(42L);
        assertThat(captor.getValue().getUserId()).isEqualTo(9001L);
        assertThat(captor.getValue().getName()).isEqualTo("Home");
        assertThat(captor.getValue().getLabel()).isEqualTo("Home, Bengaluru");
        assertThat(captor.getValue().getType()).isEqualTo("saved");
    }

    @Test
    void updateAndDeleteUseIdTenantAndUserTogether() {
        RiderSavedPlace place = place(7L, "Home");
        when(repository.findByIdAndTenantIdAndUserId(7L, 42L, 9001L)).thenReturn(Optional.of(place));
        when(repository.save(any(RiderSavedPlace.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var update = new com.velo.platform.dto.RiderSavedPlaceMutationDto();
        update.setName("Work");
        update.setLabel("Office, Bengaluru");
        update.setLat(12.8);
        update.setLon(77.6);

        assertThat(service.updateSavedPlace(7L, update).getName()).isEqualTo("Work");
        service.deleteSavedPlace(7L);

        verify(repository, org.mockito.Mockito.times(2)).findByIdAndTenantIdAndUserId(7L, 42L, 9001L);
        verify(repository).delete(place);
    }

    private RiderSavedPlace place(Long id, String name) {
        return RiderSavedPlace.builder()
                .id(id)
                .tenantId(42L)
                .userId(9001L)
                .name(name)
                .label("Home, Bengaluru")
                .latitude(12.9)
                .longitude(77.5)
                .type("saved")
                .build();
    }
}
