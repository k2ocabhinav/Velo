package com.velo.platform.events;

import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.TenantConfiguration;
import com.velo.platform.entities.User;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.TenantNotificationFormatter;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TenantNotificationFormatterTest {

    private final TenantConfigurationRepository repository = mock(TenantConfigurationRepository.class);
    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private final TenantNotificationFormatter formatter = new TenantNotificationFormatter(repository, tenantRepository);

    @Test
    void formatsCurrencyWithTheTenantCurrencyAndFrontendLocaleRules() {
        assertThat(copy("USD", "UTC").formatMoney(new BigDecimal("1511.19"))).isEqualTo("$1,511.19");
        assertThat(copy("INR", "Asia/Kolkata").formatMoney(new BigDecimal("1511.19"))).isEqualTo("₹1,511.19");
        assertThat(copy("EUR", "Europe/Paris").formatMoney(new BigDecimal("1511.19"))).isEqualTo("€1,511.19");
    }

    @Test
    void formatsUtcScheduledTimesInTheTenantZone() {
        TenantNotificationFormatter.NotificationCopy copy = copy("INR", "Asia/Kolkata");

        assertThat(copy.formatScheduledTime(LocalDateTime.of(2026, 10, 17, 0, 35)))
                .isEqualTo("Sat 17 Oct, 06:05");
    }

    @Test
    void usesBrandingLabelsAndFallsBackForMissingConfiguration() {
        TenantNotificationFormatter.NotificationCopy copy = copy("INR", "Asia/Kolkata");

        assertThat(copy.riderLabelLowercase()).isEqualTo("guest");
        assertThat(copy.driverLabelLowercase()).isEqualTo("chauffeur");
        assertThat(copy.pluralDriverLabelLowercase()).isEqualTo("chauffeurs");
        assertThat(copy.tripLabelTitleCase()).isEqualTo("Transfer");

        when(repository.findWithTenantByTenant_Id(44L)).thenReturn(Optional.empty());
        assertThat(formatter.forUser(User.builder().tenantId(44L).build()))
                .isEqualTo(TenantNotificationFormatter.NotificationCopy.defaults());
    }

    @Test
    void keepsTenantTimeZoneWhenBrandingConfigurationIsMissing() {
        when(repository.findWithTenantByTenant_Id(44L)).thenReturn(Optional.empty());
        when(tenantRepository.findById(44L))
                .thenReturn(Optional.of(Tenant.builder().id(44L).timeZone("Asia/Kolkata").build()));

        assertThat(formatter.forUser(User.builder().tenantId(44L).build()).timeZone().getId())
                .isEqualTo("Asia/Kolkata");
    }

    private TenantNotificationFormatter.NotificationCopy copy(String currency, String timeZone) {
        Tenant tenant = Tenant.builder().id(44L).timeZone(timeZone).build();
        TenantConfiguration configuration = TenantConfiguration.builder()
                .tenant(tenant)
                .riderLabel("Guest")
                .driverLabel("Chauffeur")
                .tripLabel("Transfer")
                .currency(currency)
                .build();
        when(repository.findWithTenantByTenant_Id(44L)).thenReturn(Optional.of(configuration));
        return formatter.forUser(User.builder().tenantId(44L).build());
    }
}
