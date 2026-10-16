package com.velo.platform.services;

import com.velo.platform.entities.Tenant;
import com.velo.platform.entities.TenantConfiguration;
import com.velo.platform.entities.User;
import com.velo.platform.repositories.TenantConfigurationRepository;
import com.velo.platform.repositories.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Currency;
import java.util.Locale;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class TenantNotificationFormatter {

    private static final DateTimeFormatter SCHEDULED_TIME_FORMAT =
            DateTimeFormatter.ofPattern("EEE d MMM, HH:mm", Locale.ENGLISH);
    private static final NotificationCopy DEFAULT_COPY = new NotificationCopy(
            "Rider", "Driver", "Trip", "USD", ZoneOffset.UTC);

    private final TenantConfigurationRepository tenantConfigurationRepository;
    private final TenantRepository tenantRepository;

    public NotificationCopy forUser(User user) {
        if (user == null || user.getTenantId() == null) return DEFAULT_COPY;

        Optional<TenantConfiguration> configuration =
                tenantConfigurationRepository.findWithTenantByTenant_Id(user.getTenantId());
        if (configuration.isPresent()) return toCopy(configuration.get());

        return tenantRepository.findById(user.getTenantId())
                .map(tenant -> new NotificationCopy(
                        DEFAULT_COPY.riderLabel(), DEFAULT_COPY.driverLabel(), DEFAULT_COPY.tripLabel(),
                        DEFAULT_COPY.currency(), parseZone(tenant.getTimeZone())))
                .orElse(DEFAULT_COPY);
    }

    private static NotificationCopy toCopy(TenantConfiguration configuration) {
        Tenant tenant = configuration.getTenant();
        String currency = hasText(configuration.getCurrency()) ? configuration.getCurrency().trim() : "USD";
        String riderLabel = labelOrDefault(configuration.getRiderLabel(), "Rider");
        String driverLabel = labelOrDefault(configuration.getDriverLabel(), "Driver");
        String tripLabel = labelOrDefault(configuration.getTripLabel(), "Trip");
        ZoneId zone = parseZone(tenant == null ? null : tenant.getTimeZone());
        return new NotificationCopy(riderLabel, driverLabel, tripLabel, currency, zone);
    }

    private static String labelOrDefault(String label, String fallback) {
        return hasText(label) ? label.trim() : fallback;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static ZoneId parseZone(String value) {
        if (!hasText(value)) return ZoneOffset.UTC;
        try {
            return ZoneId.of(value.trim());
        } catch (DateTimeException ignored) {
            return ZoneOffset.UTC;
        }
    }

    public record NotificationCopy(String riderLabel, String driverLabel, String tripLabel,
                                   String currency, ZoneId timeZone) {

        public static NotificationCopy defaults() {
            return DEFAULT_COPY;
        }

        public String riderLabelLowercase() {
            return lowercaseFirst(riderLabel);
        }

        public String riderLabelTitleCase() {
            return uppercaseFirst(riderLabel);
        }

        public String driverLabelLowercase() {
            return lowercaseFirst(driverLabel);
        }

        public String driverLabelTitleCase() {
            return uppercaseFirst(driverLabel);
        }

        public String pluralDriverLabelLowercase() {
            return pluralize(driverLabelLowercase());
        }

        public String pluralDriverLabelTitleCase() {
            return uppercaseFirst(pluralDriverLabelLowercase());
        }

        public String tripLabelLowercase() {
            return lowercaseFirst(tripLabel);
        }

        public String tripLabelTitleCase() {
            return uppercaseFirst(tripLabel);
        }

        public String formatMoney(BigDecimal amount) {
            Currency resolvedCurrency = resolveCurrency(currency);
            Locale locale = "INR".equals(resolvedCurrency.getCurrencyCode())
                    ? Locale.forLanguageTag("en-IN")
                    : Locale.US;
            NumberFormat formatter = NumberFormat.getCurrencyInstance(locale);
            formatter.setCurrency(resolvedCurrency);
            formatter.setMinimumFractionDigits(Math.min(2, Math.max(0, resolvedCurrency.getDefaultFractionDigits())));
            formatter.setMaximumFractionDigits(2);
            return formatter.format(amount);
        }

        public String formatScheduledTime(LocalDateTime utcTime) {
            if (utcTime == null) return "—";
            return utcTime.atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(timeZone == null ? ZoneOffset.UTC : timeZone)
                    .format(SCHEDULED_TIME_FORMAT);
        }

        private static Currency resolveCurrency(String code) {
            if (hasText(code)) {
                try {
                    return Currency.getInstance(code.trim().toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException ignored) {
                    // Invalid tenant configuration falls back to the platform's default currency.
                }
            }
            return Currency.getInstance("USD");
        }

        private static String lowercaseFirst(String value) {
            if (!hasText(value)) return "";
            int firstCodePoint = value.codePointAt(0);
            int firstWidth = Character.charCount(firstCodePoint);
            return new String(Character.toChars(Character.toLowerCase(firstCodePoint))) + value.substring(firstWidth);
        }

        private static String uppercaseFirst(String value) {
            if (!hasText(value)) return "";
            int firstCodePoint = value.codePointAt(0);
            int firstWidth = Character.charCount(firstCodePoint);
            return new String(Character.toChars(Character.toTitleCase(firstCodePoint))) + value.substring(firstWidth);
        }

        private static String pluralize(String value) {
            if (value.endsWith("s") || value.endsWith("x") || value.endsWith("z")
                    || value.endsWith("ch") || value.endsWith("sh")) {
                return value + "es";
            }
            if (value.length() > 1 && value.endsWith("y")
                    && !"aeiou".contains(value.substring(value.length() - 2, value.length() - 1))) {
                return value.substring(0, value.length() - 1) + "ies";
            }
            return value + "s";
        }
    }
}
