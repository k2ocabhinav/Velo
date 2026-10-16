package com.velo.platform.services.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.configs.GeocodingProperties;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.entities.Tenant;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.GeocodingService;
import com.velo.platform.services.TenantScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class NominatimGeocodingService implements GeocodingService {
    private static final int SEARCH_LIMIT = 6;
    private static final int MAX_MEMORY_CACHE_ENTRIES = 10_000;
    private static final double KM_PER_DEGREE_LATITUDE = 111.32;
    private static final TypeReference<List<GeocodingResultDto>> RESULTS_TYPE = new TypeReference<>() { };

    private final GeocodingProperties properties;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final NominatimRateLimiter rateLimiter;
    @Qualifier("geocodingRestTemplate")
    private final RestTemplate restTemplate;
    private final TenantScopeService tenantScopeService;
    private final TenantRepository tenantRepository;
    private final Map<String, CachedValue> memoryCache = new ConcurrentHashMap<>();

    @Override
    public List<GeocodingResultDto> search(String query, String near) {
        String normalizedQuery = query.trim().replaceAll("\\s+", " ");
        ServiceArea serviceArea = resolveServiceArea();
        String cacheKey = cacheKey("search", properties.getBaseUrl(), properties.getCountryBias(),
                normalizedQuery.toLowerCase(), near == null ? "" : near.trim(), serviceArea.cacheKey());
        return cached(cacheKey, RESULTS_TYPE, () -> fetchSearch(normalizedQuery, near, serviceArea));
    }

    @Override
    public GeocodingResultDto reverse(double latitude, double longitude) {
        String coordinates = String.format(java.util.Locale.ROOT, "%.6f,%.6f", latitude, longitude);
        String cacheKey = cacheKey("reverse", properties.getBaseUrl(), coordinates);
        return cached(cacheKey, new TypeReference<>() { }, () -> fetchReverse(latitude, longitude));
    }

    private List<GeocodingResultDto> fetchSearch(String query, String near, ServiceArea serviceArea) {
        GeoPoint anchor = resolveAnchor(near, serviceArea).orElse(null);
        String searchQuery = anchor != null || near == null || near.isBlank()
                ? query
                : query + ", " + near.trim();
        if (anchor != null) {
            List<GeocodingResultDto> localResults = fetchSearch(searchQuery, anchor, serviceArea.radiusKm(), true);
            if (!localResults.isEmpty()) {
                return rankByDistance(localResults, anchor, isGenericAirportSearch(query));
            }
            return rankByDistance(fetchSearch(searchQuery, anchor, serviceArea.radiusKm(), false), anchor, false);
        }
        return fetchSearch(searchQuery, null, serviceArea.radiusKm(), false);
    }

    private List<GeocodingResultDto> fetchSearch(String query, GeoPoint anchor, double radiusKm, boolean bounded) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(properties.getBaseUrl())
                .path("/search")
                .queryParam("format", "jsonv2")
                .queryParam("q", query)
                .queryParam("limit", SEARCH_LIMIT)
                .queryParam("addressdetails", 1);
        addCountryBias(uri);
        addViewbox(uri, anchor, radiusKm, bounded);
        addProviderEmail(uri);

        JsonNode response = get(uri.build().encode().toUri());
        if (response == null || !response.isArray()) {
            throw new GeocodingUnavailableException();
        }
        List<GeocodingResultDto> results = new ArrayList<>();
        for (JsonNode result : response) {
            GeocodingResultDto mapped = mapResult(result);
            if (mapped != null) {
                results.add(mapped);
            }
        }
        return results;
    }

    private Optional<GeoPoint> resolveAnchor(String near, ServiceArea serviceArea) {
        Optional<GeoPoint> parsed = parseCoordinates(near);
        if (parsed.isPresent()) {
            return parsed;
        }
        if (near != null && !near.isBlank()) {
            String normalized = near.trim().replaceAll("\\s+", " ");
            List<GeocodingResultDto> matches = cached(
                    cacheKey("near", properties.getBaseUrl(), properties.getCountryBias(), normalized.toLowerCase()),
                    RESULTS_TYPE,
                    () -> fetchNear(normalized));
            if (!matches.isEmpty()) {
                GeocodingResultDto result = matches.getFirst();
                return Optional.of(new GeoPoint(result.lat(), result.lon()));
            }
        }
        return serviceAreaPoint(serviceArea);
    }

    private List<GeocodingResultDto> fetchNear(String query) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(properties.getBaseUrl())
                .path("/search")
                .queryParam("format", "jsonv2")
                .queryParam("q", query)
                .queryParam("limit", 1)
                .queryParam("addressdetails", 0);
        addCountryBias(uri);
        addProviderEmail(uri);

        JsonNode response = get(uri.build().encode().toUri());
        if (response == null || !response.isArray()) {
            throw new GeocodingUnavailableException();
        }
        List<GeocodingResultDto> results = new ArrayList<>(1);
        for (JsonNode result : response) {
            GeocodingResultDto mapped = mapResult(result);
            if (mapped != null) {
                results.add(mapped);
            }
        }
        return results;
    }

    private Optional<GeoPoint> parseCoordinates(String near) {
        if (near == null || near.isBlank()) {
            return Optional.empty();
        }
        String[] coordinates = near.split(",");
        if (coordinates.length != 2) {
            return Optional.empty();
        }
        try {
            double latitude = Double.parseDouble(coordinates[0].trim());
            double longitude = Double.parseDouble(coordinates[1].trim());
            if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
                return Optional.of(new GeoPoint(latitude, longitude));
            }
        } catch (NumberFormatException ignored) {
            // A named near value is resolved as a place below.
        }
        return Optional.empty();
    }

    private Optional<GeoPoint> serviceAreaPoint(ServiceArea serviceArea) {
        Double latitude = serviceArea == null ? null : serviceArea.latitude();
        Double longitude = serviceArea == null ? null : serviceArea.longitude();
        if (latitude == null || longitude == null
                || !Double.isFinite(latitude) || !Double.isFinite(longitude)
                || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return Optional.empty();
        }
        return Optional.of(new GeoPoint(latitude, longitude));
    }

    private void addViewbox(UriComponentsBuilder uri, GeoPoint anchor, double radiusKm, boolean bounded) {
        if (anchor == null) {
            return;
        }
        double latitudeRadius = radiusKm / KM_PER_DEGREE_LATITUDE;
        double longitudeRadius = Math.min(180.0, radiusKm
                / (KM_PER_DEGREE_LATITUDE * Math.max(0.01, Math.cos(Math.toRadians(anchor.latitude())))));
        uri.queryParam("viewbox", String.format(java.util.Locale.ROOT, "%.5f,%.5f,%.5f,%.5f",
                anchor.longitude() - longitudeRadius,
                anchor.latitude() + latitudeRadius,
                anchor.longitude() + longitudeRadius,
                anchor.latitude() - latitudeRadius));
        uri.queryParam("bounded", bounded ? 1 : 0);
    }

    private ServiceArea resolveServiceArea() {
        Tenant tenant = tenantRepository.findById(tenantScopeService.requireCurrentTenantId()).orElse(null);
        Double latitude = tenant == null || tenant.getServiceAreaLatitude() == null
                ? properties.getServiceAreaLatitude() : tenant.getServiceAreaLatitude();
        Double longitude = tenant == null || tenant.getServiceAreaLongitude() == null
                ? properties.getServiceAreaLongitude() : tenant.getServiceAreaLongitude();
        double radiusKm = tenant == null || tenant.getServiceAreaRadiusKm() == null
                ? valueOrDefault(properties.getServiceAreaRadiusKm(), 60.0) : tenant.getServiceAreaRadiusKm();
        if (latitude != null && longitude != null
                && (!Double.isFinite(latitude) || latitude < -90 || latitude > 90
                || !Double.isFinite(longitude) || longitude < -180 || longitude > 180)) {
            latitude = null;
            longitude = null;
        }
        if (!Double.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
            radiusKm = 60.0;
        }
        return new ServiceArea(latitude, longitude, radiusKm);
    }

    private double valueOrDefault(Double value, double fallback) {
        return value == null ? fallback : value;
    }

    private List<GeocodingResultDto> rankByDistance(
            List<GeocodingResultDto> results,
            GeoPoint anchor,
            boolean preferInternationalAirport) {
        return results.stream()
                .sorted(Comparator
                        .comparingInt((GeocodingResultDto result) -> preferInternationalAirport
                                && isInternationalAirport(result) ? 0 : 1)
                        .thenComparingDouble(result -> distanceKm(anchor, result.lat(), result.lon())))
                .toList();
    }

    private boolean isGenericAirportSearch(String query) {
        return "airport".equalsIgnoreCase(query.trim());
    }

    private boolean isInternationalAirport(GeocodingResultDto result) {
        return result.label() != null
                && result.label().toLowerCase(java.util.Locale.ROOT).contains("international airport");
    }

    private double distanceKm(GeoPoint anchor, double latitude, double longitude) {
        double lat1 = Math.toRadians(anchor.latitude());
        double lat2 = Math.toRadians(latitude);
        double deltaLat = lat2 - lat1;
        double deltaLon = Math.toRadians(longitude - anchor.longitude());
        double haversine = Math.pow(Math.sin(deltaLat / 2), 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLon / 2), 2);
        return 2 * 6371.0088 * Math.asin(Math.sqrt(Math.min(1, haversine)));
    }

    private GeocodingResultDto fetchReverse(double latitude, double longitude) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(properties.getBaseUrl())
                .path("/reverse")
                .queryParam("format", "jsonv2")
                .queryParam("lat", latitude)
                .queryParam("lon", longitude)
                .queryParam("zoom", 18)
                .queryParam("addressdetails", 1);
        addProviderEmail(uri);
        JsonNode response = get(uri.build().encode().toUri());
        GeocodingResultDto result = mapResult(response);
        if (result == null) {
            throw new GeocodingUnavailableException();
        }
        return result;
    }

    private JsonNode get(URI uri) {
        return rateLimiter.execute(() -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set(HttpHeaders.USER_AGENT, properties.getUserAgent());
            try {
                return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class)
                        .getBody();
            } catch (RestClientException exception) {
                throw new GeocodingUnavailableException(exception);
            }
        });
    }

    private void addProviderEmail(UriComponentsBuilder uri) {
        if (properties.getEmail() == null || properties.getEmail().isBlank()) {
            return;
        }
        uri.queryParam("email", properties.getEmail().trim());
    }

    private void addCountryBias(UriComponentsBuilder uri) {
        if (properties.getCountryBias() != null && !properties.getCountryBias().isBlank()) {
            uri.queryParam("countrycodes", properties.getCountryBias().trim().toLowerCase());
        }
    }

    private GeocodingResultDto mapResult(JsonNode result) {
        if (result == null || !result.isObject()) {
            return null;
        }
        String fullAddress = text(result, "display_name");
        String latitude = text(result, "lat");
        String longitude = text(result, "lon");
        if (fullAddress == null || latitude == null || longitude == null) {
            return null;
        }
        try {
            String type = text(result, "type");
            if (type == null) {
                type = text(result, "class");
            }
            return new GeocodingResultDto(NominatimAddressLabelBuilder.build(result), fullAddress,
                    Double.parseDouble(latitude), Double.parseDouble(longitude), type == null ? "address" : type);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.asText().isBlank() ? null : value.asText();
    }

    private <T> T cached(String key, TypeReference<T> type, Supplier<T> providerCall) {
        CachedValue local = memoryCache.get(key);
        if (local != null && local.expiresAt().isAfter(Instant.now())) {
            return type(type, local.json());
        }
        if (local != null) {
            memoryCache.remove(key, local);
        }

        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                String json = cached.toString();
                T value = type(type, json);
                memoryCache.put(key, new CachedValue(json, Instant.now().plus(properties.getCacheTtl())));
                return value;
            }
        } catch (RuntimeException ignored) {
            // Redis is optional for geocoding; the in-memory cache remains available.
        }

        T value = providerCall.get();
        try {
            String json = objectMapper.writeValueAsString(value);
            Instant expiresAt = Instant.now().plus(properties.getCacheTtl());
            memoryCache.put(key, new CachedValue(json, expiresAt));
            if (memoryCache.size() > MAX_MEMORY_CACHE_ENTRIES) {
                memoryCache.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(Instant.now()));
                if (memoryCache.size() > MAX_MEMORY_CACHE_ENTRIES) {
                    memoryCache.clear();
                }
            }
            try {
                redisTemplate.opsForValue().set(key, json, properties.getCacheTtl());
            } catch (RuntimeException ignored) {
                // Redis failures must not turn a successful provider lookup into a failed request.
            }
            return value;
        } catch (JsonProcessingException exception) {
            throw new GeocodingUnavailableException(exception);
        }
    }

    private <T> T type(TypeReference<T> type, String json) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException exception) {
            throw new GeocodingUnavailableException(exception);
        }
    }

    private String cacheKey(String... parts) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String input = String.join("|", parts);
            return "velo:geo:v6:" + HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private record CachedValue(String json, Instant expiresAt) { }
    private record GeoPoint(double latitude, double longitude) { }
    private record ServiceArea(Double latitude, Double longitude, double radiusKm) {
        private String cacheKey() {
            return String.format(java.util.Locale.ROOT, "%s,%s,%.2f",
                    latitude == null ? "" : String.format(java.util.Locale.ROOT, "%.5f", latitude),
                    longitude == null ? "" : String.format(java.util.Locale.ROOT, "%.5f", longitude), radiusKm);
        }
    }
}
