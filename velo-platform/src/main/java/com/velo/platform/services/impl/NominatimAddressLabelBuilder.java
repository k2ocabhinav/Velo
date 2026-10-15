package com.velo.platform.services.impl;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Iterator;
import java.util.List;
import java.util.Locale;

final class NominatimAddressLabelBuilder {
    private static final List<String> ROAD_FIELDS = List.of(
            "road", "pedestrian", "residential", "highway", "footway", "path"
    );
    private static final List<String> LOCALITY_FIELDS = List.of(
            "neighbourhood", "quarter", "suburb", "city", "town", "village", "municipality"
    );

    private NominatimAddressLabelBuilder() { }

    static String build(JsonNode result) {
        String displayName = text(result, "display_name");
        JsonNode address = result == null ? null : result.path("address");
        String name = text(result, "name");
        String road = firstText(address, ROAD_FIELDS);
        String locality = firstText(address, LOCALITY_FIELDS);
        String houseNumber = text(address, "house_number");

        String primary = name;
        String firstPart = firstDisplayPart(displayName);
        String nearbyAnchor = road == null ? firstPart : road;
        String nearby = firstDisplayPartAfter(displayName, nearbyAnchor);
        if (address == null || !address.isObject() || address.isEmpty() || matchesAddressValue(address, nearby)) {
            nearby = null;
        }
        String secondary;
        if (road == null) {
            secondary = nearby;
        } else {
            secondary = name == null ? nearby : road;
        }
        if (secondary == null) {
            secondary = locality;
        }
        if (primary == null) {
            primary = road == null ? firstDisplayPart(displayName) : join(houseNumber, road, " ");
            secondary = nearby;
            if (secondary == null) {
                secondary = locality;
            }
        } else if (same(primary, secondary)) {
            secondary = locality;
        }

        String label = join(primary, secondary, ", ");
        if (label == null) {
            label = firstDisplayPart(displayName);
        }
        return label == null ? displayName : label;
    }

    private static String firstText(JsonNode node, List<String> fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || !value.isValueNode()) {
            return null;
        }
        String text = value.asText().trim();
        return text.isEmpty() ? null : text;
    }

    private static String firstDisplayPart(String displayName) {
        if (displayName == null) {
            return null;
        }
        String[] parts = displayName.split(",", 2);
        String first = parts[0].trim();
        return first.isEmpty() ? null : first;
    }

    private static String firstDisplayPartAfter(String displayName, String anchor) {
        if (displayName == null || anchor == null) {
            return null;
        }
        String[] parts = displayName.split(",");
        for (int index = 0; index < parts.length - 1; index++) {
            String part = parts[index].trim();
            if (part.toLowerCase(Locale.ROOT).contains(anchor.toLowerCase(Locale.ROOT))) {
                String next = parts[index + 1].trim();
                if (!next.isEmpty() && !same(next, anchor)) {
                    return next;
                }
            }
        }
        return null;
    }

    private static boolean matchesAddressValue(JsonNode address, String candidate) {
        if (candidate == null || address == null || !address.isObject()) {
            return false;
        }
        Iterator<JsonNode> values = address.elements();
        while (values.hasNext()) {
            JsonNode value = values.next();
            if (value.isValueNode() && same(candidate, value.asText().trim())) {
                return true;
            }
        }
        return false;
    }

    private static String join(String first, String second, String separator) {
        if (first == null) {
            return second;
        }
        if (second == null || same(first, second)) {
            return first;
        }
        return first + separator + second;
    }

    private static boolean same(String first, String second) {
        return first != null && second != null && first.equalsIgnoreCase(second);
    }
}
