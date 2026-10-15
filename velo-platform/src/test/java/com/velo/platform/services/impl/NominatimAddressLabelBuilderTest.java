package com.velo.platform.services.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class NominatimAddressLabelBuilderTest {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @ParameterizedTest
    @MethodSource("nominatimFixtures")
    void buildsShortLabelsFromNominatimAddressComponents(String fixture, String expected) throws Exception {
        JsonNode result = OBJECT_MAPPER.readTree(fixture);

        assertThat(NominatimAddressLabelBuilder.build(result)).isEqualTo(expected);
    }

    @Test
    void fallsBackToTheFirstDisplayNamePartWhenAddressDetailsAreMissing() throws Exception {
        JsonNode result = OBJECT_MAPPER.readTree("""
                {"display_name":"Central Station, Paris, France"}
                """);

        assertThat(NominatimAddressLabelBuilder.build(result)).isEqualTo("Central Station");
    }

    private static Stream<org.junit.jupiter.params.provider.Arguments> nominatimFixtures() {
        return Stream.of(
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"name":"Kempegowda International Airport","display_name":"Kempegowda International Airport, Devanahalli, Bengaluru Rural, Karnataka, India","address":{"airport":"Kempegowda International Airport","city":"Devanahalli","state_district":"Bengaluru Rural","state":"Karnataka","country":"India"}}
                        """, "Kempegowda International Airport, Devanahalli"),
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"name":"The Oberoi Bengaluru","display_name":"The Oberoi Bengaluru, Mahatma Gandhi Road, Shanthala Nagar, Bengaluru, Karnataka, India","address":{"hotel":"The Oberoi Bengaluru","road":"Mahatma Gandhi Road","suburb":"Shanthala Nagar","city":"Bengaluru","state":"Karnataka","country":"India"}}
                        """, "The Oberoi Bengaluru, Mahatma Gandhi Road"),
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"name":"Mahatma Gandhi Road","display_name":"Mahatma Gandhi Road, Shanthala Nagar, Ashokanagar, Bengaluru Central City Corporation, Bengaluru, Karnataka, India","address":{"railway":"Mahatma Gandhi Road","road":"Mahatma Gandhi Road","quarter":"Shanthala Nagar","suburb":"Ashokanagar","city":"Bengaluru","state":"Karnataka","country":"India"},"type":"station"}
                        """, "Mahatma Gandhi Road, Shanthala Nagar"),
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"display_name":"Mahatma Gandhi Road, Shanthala Nagar, Ashokanagar, Bengaluru Central City Corporation, Bengaluru, Karnataka, India","address":{"road":"Mahatma Gandhi Road","suburb":"Ashokanagar","city_district":"Bengaluru Central City Corporation","city":"Bengaluru","state":"Karnataka","country":"India"}}
                        """, "Mahatma Gandhi Road, Shanthala Nagar"),
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"name":"Mahatma Gandhi Road","display_name":"Mahatma Gandhi Road, Shanthala Nagar, Ashokanagar, Bengaluru Central City Corporation, Bengaluru, Karnataka, India","address":{"suburb":"Ashokanagar","city_district":"Bengaluru Central City Corporation","city":"Bengaluru","state":"Karnataka","country":"India"},"type":"station"}
                        """, "Mahatma Gandhi Road, Shanthala Nagar"),
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"display_name":"Rue de Rivoli, 1st Arrondissement, Paris, Île-de-France, France","address":{"road":"Rue de Rivoli","neighbourhood":"1st Arrondissement","city":"Paris","state":"Île-de-France","country":"France"}}
                        """, "Rue de Rivoli, 1st Arrondissement"),
                org.junit.jupiter.params.provider.Arguments.of("""
                        {"display_name":"5th Avenue, Manhattan, New York, NY, United States","address":{"road":"5th Avenue","neighbourhood":"Manhattan","city":"New York","state":"New York","postcode":"10018","country":"United States"}}
                        """, "5th Avenue, Manhattan")
        );
    }
}
