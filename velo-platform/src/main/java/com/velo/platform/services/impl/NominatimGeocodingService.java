package com.velo.platform.services.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.configs.GeocodingProperties;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.services.GeocodingService;
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
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class NominatimGeocodingService implements GeocodingService {
    private static final int SEARCH_LIMIT = 6;
    private static final int MAX_MEMORY_CACHE_ENTRIES = 10_000;
    private static final TypeReference<List<GeocodingResultDto>> RESULTS_TYPE = new TypeReference<>() { };

    private final GeocodingProperties properties;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final NominatimRateLimiter rateLimiter;
    @Qualifier("geocodingRestTemplate")
    private final RestTemplate restTemplate;
    private final Map<String, CachedValue> memoryCache = new ConcurrentHashMap<>();

    @Override
    public List<GeocodingResultDto> search(String query, String near) {
        String normalizedQuery = query.trim().replaceAll("\\s+", " ");
        String cacheKey = cacheKey("search", properties.getBaseUrl(), properties.getCountryBias(),
                normalizedQuery.toLowerCase(), near == null ? "" : near.trim());
        return cached(cacheKey, RESULTS_TYPE, () -> fetchSearch(normalizedQuery, near));
    }

    @Override
    public GeocodingResultDto reverse(double latitude, double longitude) {
        String coordinates = String.format(java.util.Locale.ROOT, "%.6f,%.6f", latitude, longitude);
        String cacheKey = cacheKey("reverse", properties.getBaseUrl(), coordinates);
        return cached(cacheKey, new TypeReference<>() { }, () -> fetchReverse(latitude, longitude));
    }

    private List<GeocodingResultDto> fetchSearch(String query, String near) {
        String searchQuery = isCoordinateNear(near) || near == null || near.isBlank()
                ? query
                : query + ", " + near.trim();
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(properties.getBaseUrl())
                .path("/search")
                .queryParam("format", "jsonv2")
                .queryParam("q", searchQuery)
                .queryParam("limit", SEARCH_LIMIT)
                .queryParam("addressdetails", 0);
        addCountryBias(uri);
        addNearBias(uri, near);
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

    private GeocodingResultDto fetchReverse(double latitude, double longitude) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(properties.getBaseUrl())
                .path("/reverse")
                .queryParam("format", "jsonv2")
                .queryParam("lat", latitude)
                .queryParam("lon", longitude)
                .queryParam("zoom", 18);
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

    private void addNearBias(UriComponentsBuilder uri, String near) {
        if (near == null || near.isBlank()) {
            return;
        }
        String[] coordinates = near.split(",");
        if (coordinates.length == 2) {
            try {
                double latitude = Double.parseDouble(coordinates[0].trim());
                double longitude = Double.parseDouble(coordinates[1].trim());
                if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
                    double radius = 0.15;
                    uri.queryParam("viewbox", String.format(java.util.Locale.ROOT, "%.5f,%.5f,%.5f,%.5f",
                            longitude - radius, latitude + radius, longitude + radius, latitude - radius));
                    return;
                }
            } catch (NumberFormatException ignored) {
                // A place name is still useful as textual search context below.
            }
        }
    }

    private boolean isCoordinateNear(String near) {
        if (near == null) {
            return false;
        }
        String[] coordinates = near.split(",");
        if (coordinates.length != 2) {
            return false;
        }
        try {
            double latitude = Double.parseDouble(coordinates[0].trim());
            double longitude = Double.parseDouble(coordinates[1].trim());
            return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private GeocodingResultDto mapResult(JsonNode result) {
        if (result == null || !result.isObject()) {
            return null;
        }
        String label = text(result, "display_name");
        String latitude = text(result, "lat");
        String longitude = text(result, "lon");
        if (label == null || latitude == null || longitude == null) {
            return null;
        }
        try {
            String type = text(result, "type");
            if (type == null) {
                type = text(result, "class");
            }
            return new GeocodingResultDto(label, Double.parseDouble(latitude), Double.parseDouble(longitude),
                    type == null ? "address" : type);
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
            return "velo:geo:v1:" + HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private record CachedValue(String json, Instant expiresAt) { }
}
