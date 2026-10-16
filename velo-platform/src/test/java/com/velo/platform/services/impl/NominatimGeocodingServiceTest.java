package com.velo.platform.services.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velo.platform.configs.GeocodingProperties;
import com.velo.platform.dto.GeocodingResultDto;
import com.velo.platform.entities.Tenant;
import com.velo.platform.exceptions.GeocodingUnavailableException;
import com.velo.platform.repositories.TenantRepository;
import com.velo.platform.services.TenantScopeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class NominatimGeocodingServiceTest {
    private RestTemplate restTemplate;
    private MockRestServiceServer provider;
    private NominatimGeocodingService service;
    private TenantRepository tenantRepository;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        restTemplate = new RestTemplate();
        provider = MockRestServiceServer.bindTo(restTemplate).build();
        GeocodingProperties properties = new GeocodingProperties();
        properties.setBaseUrl("https://geo.test");
        properties.setUserAgent("Velo geocoding tests");
        properties.setEmail("geo@example.test");
        properties.setCountryBias("IN");
        properties.setTimeout(Duration.ofSeconds(1));
        properties.setCacheTtl(Duration.ofHours(24));

        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        TenantScopeService tenantScopeService = mock(TenantScopeService.class);
        when(tenantScopeService.requireCurrentTenantId()).thenReturn(1L);
        tenantRepository = mock(TenantRepository.class);
        ValueOperations<String, Object> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(org.mockito.ArgumentMatchers.anyString())).thenReturn(null);
        service = new NominatimGeocodingService(properties, new ObjectMapper(), redisTemplate,
                new NominatimRateLimiter(), restTemplate, tenantScopeService, tenantRepository);
    }

    @AfterEach
    void verifyProvider() {
        provider.verify();
    }

    @Test
    void searchNormalizesProviderResultsAndAppliesConfiguredHeadersAndBias() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("https://geo.test/search")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("User-Agent", "Velo geocoding tests"))
                .andExpect(queryParam("q", "Central%20Market"))
                .andExpect(queryParam("addressdetails", "1"))
                .andExpect(queryParam("countrycodes", "in"))
                .andExpect(queryParam("email", "geo@example.test"))
                .andExpect(queryParam("viewbox", "76.94706,13.43899,78.05294,12.36101"))
                .andExpect(queryParam("bounded", "1"))
                .andRespond(withSuccess("""
                        [{"name":"Central Market","display_name":"Central Market, Bengaluru, Karnataka, India","address":{"marketplace":"Central Market","city":"Bengaluru","state":"Karnataka","country":"India"},"lat":"12.9","lon":"77.5","type":"market"}]
                        """, MediaType.APPLICATION_JSON));

        List<GeocodingResultDto> results = service.search("  Central   Market ", "12.9,77.5");

        assertThat(results).containsExactly(new GeocodingResultDto(
                "Central Market, Bengaluru", "Central Market, Bengaluru, Karnataka, India", 12.9, 77.5, "market"));
    }

    @Test
    void searchUsesTenantServiceAreaCenterAndRadius() {
        when(tenantRepository.findById(1L)).thenReturn(Optional.of(Tenant.builder()
                .serviceAreaLatitude(12.9716)
                .serviceAreaLongitude(77.5946)
                .serviceAreaRadiusKm(30.0)
                .build()));
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("viewbox", "77.31805,13.24109,77.87115,12.70211"))
                .andExpect(queryParam("bounded", "1"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("viewbox", "77.31805,13.24109,77.87115,12.70211"))
                .andExpect(queryParam("bounded", "0"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThat(service.search("Cafe", null)).isEmpty();
    }

    @Test
    void genericAirportSearchPrefersTheLocalInternationalAirport() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("q", "Bengaluru"))
                .andExpect(queryParam("limit", "1"))
                .andRespond(withSuccess("""
                        [{"display_name":"Bengaluru, Karnataka, India","lat":"12.9716","lon":"77.5946","type":"city"}]
                        """, MediaType.APPLICATION_JSON));
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("q", "Airport"))
                .andExpect(queryParam("viewbox", "77.04150,13.51059,78.14770,12.43261"))
                .andExpect(queryParam("bounded", "1"))
                .andRespond(withSuccess("""
                        [
                          {"display_name":"Kempegowda International Airport, Devanahalli, Karnataka, India","address":{"airport":"Kempegowda International Airport","city":"Bengaluru","state":"Karnataka","country":"India"},"lat":"13.1989","lon":"77.7068","type":"aerodrome"},
                          {"display_name":"Bengaluru Airport Road, Bengaluru, India","address":{"road":"Bengaluru Airport Road","city":"Bengaluru","state":"Karnataka","country":"India"},"lat":"12.9800","lon":"77.6000","type":"road"}
                        ]
                        """, MediaType.APPLICATION_JSON));

        List<GeocodingResultDto> results = service.search("Airport", "Bengaluru");

        assertThat(results).extracting(GeocodingResultDto::fullAddress).containsExactly(
                "Kempegowda International Airport, Devanahalli, Karnataka, India",
                "Bengaluru Airport Road, Bengaluru, India");
    }

    @Test
    void otherLocalSearchesRemainRankedByDistance() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("q", "Cafe"))
                .andExpect(queryParam("bounded", "1"))
                .andRespond(withSuccess("""
                        [
                          {"display_name":"Far Cafe, Bengaluru, India","address":{"cafe":"Far Cafe","city":"Bengaluru","country":"India"},"lat":"13.02","lon":"77.59","type":"cafe"},
                          {"display_name":"Near Cafe, Bengaluru, India","address":{"cafe":"Near Cafe","city":"Bengaluru","country":"India"},"lat":"12.9720","lon":"77.5950","type":"cafe"}
                        ]
                        """, MediaType.APPLICATION_JSON));

        List<GeocodingResultDto> results = service.search("Cafe", "12.9716,77.5946");

        assertThat(results).extracting(GeocodingResultDto::label)
                .containsExactly("Near Cafe, Bengaluru", "Far Cafe, Bengaluru");
    }

    @Test
    void emptyBoundedSearchFallsBackToUnboundedResults() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("q", "Airport"))
                .andExpect(queryParam("bounded", "1"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("/search")))
                .andExpect(queryParam("q", "Airport"))
                .andExpect(queryParam("bounded", "0"))
                .andRespond(withSuccess("""
                        [
                          {"display_name":"Kempegowda International Airport, Karnataka, India","address":{"airport":"Kempegowda International Airport","city":"Bengaluru","country":"India"},"lat":"13.1989","lon":"77.7068","type":"aerodrome"},
                          {"display_name":"HAL Airport, Bengaluru, India","address":{"airport":"HAL Airport","city":"Bengaluru","country":"India"},"lat":"12.9515","lon":"77.6706","type":"aerodrome"}
                        ]
                        """, MediaType.APPLICATION_JSON));

        List<GeocodingResultDto> results = service.search("Airport", "12.9716,77.5946");

        assertThat(results).extracting(GeocodingResultDto::fullAddress)
                .containsExactly("HAL Airport, Bengaluru, India", "Kempegowda International Airport, Karnataka, India");
    }

    @Test
    void cachesSearchResultsInMemoryWhenRedisHasNoEntry() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("https://geo.test/search")))
                .andRespond(withSuccess("""
                        [{"display_name":"City Library, Bengaluru, India","address":{"library":"City Library","city":"Bengaluru","country":"India"},"lat":"12.91","lon":"77.51","type":"library"}]
                        """, MediaType.APPLICATION_JSON));

        List<GeocodingResultDto> first = service.search("City Library", null);
        List<GeocodingResultDto> second = service.search("City Library", null);

        assertThat(second).isEqualTo(first);
    }

    @Test
    void reverseGeocodingReturnsNormalizedAddress() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("https://geo.test/reverse")))
                .andExpect(queryParam("lat", "12.9"))
                .andExpect(queryParam("lon", "77.5"))
                .andExpect(queryParam("addressdetails", "1"))
                .andRespond(withSuccess("""
                        {"display_name":"12 Main Road, Bengaluru, Karnataka, India","address":{"house_number":"12","road":"Main Road","suburb":"Indiranagar","city":"Bengaluru","state":"Karnataka","country":"India"},"lat":"12.9","lon":"77.5","type":"road"}
                        """, MediaType.APPLICATION_JSON));

        assertThat(service.reverse(12.9, 77.5))
                .isEqualTo(new GeocodingResultDto(
                        "12 Main Road, Indiranagar", "12 Main Road, Bengaluru, Karnataka, India", 12.9, 77.5, "road"));
    }

    @Test
    void providerFailureBecomesClearServiceUnavailableError() {
        provider.expect(requestTo(org.hamcrest.Matchers.containsString("https://geo.test/search")))
                .andRespond(withServerError());

        assertThatThrownBy(() -> service.search("Airport", null))
                .isInstanceOf(GeocodingUnavailableException.class)
                .hasMessage("The address service is temporarily unavailable. Please try again.");
    }
}
