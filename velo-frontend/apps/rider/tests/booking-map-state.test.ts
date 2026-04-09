import { describe, expect, it } from "vitest";
import {
  buildRideDraftSignature,
  hasCompleteLocationSelection,
  inputStringsToMapPoint,
  mapPointToInputStrings,
} from "../app/_lib/booking-map-state";
import { validatePointInput } from "../app/_lib/ride-forms";

describe("booking map state helpers", () => {
  it("converts map point to input strings", () => {
    expect(mapPointToInputStrings({ lat: 12.9716, lng: 77.5946 })).toEqual({
      lat: "12.9716",
      lng: "77.5946",
    });
  });

  it("parses valid input strings to map point", () => {
    expect(inputStringsToMapPoint("12.9716", "77.5946")).toEqual({
      lat: 12.9716,
      lng: 77.5946,
    });
  });

  it("returns null for non-numeric input", () => {
    expect(inputStringsToMapPoint("abc", "77.5")).toBeNull();
    expect(inputStringsToMapPoint("12.9", "xyz")).toBeNull();
    expect(inputStringsToMapPoint("", "77.5")).toBeNull();
  });

  it("returns null for out-of-range latitude", () => {
    expect(inputStringsToMapPoint("91", "77.5")).toBeNull();
    expect(inputStringsToMapPoint("-91", "77.5")).toBeNull();
  });

  it("returns null for out-of-range longitude", () => {
    expect(inputStringsToMapPoint("12.9", "181")).toBeNull();
    expect(inputStringsToMapPoint("12.9", "-181")).toBeNull();
  });

  it("trims whitespace from input strings", () => {
    expect(inputStringsToMapPoint("  12.9716  ", "  77.5946  ")).toEqual({
      lat: 12.9716,
      lng: 77.5946,
    });
  });

  it("round-trips map point through strings to GeoJSON with correct [lng, lat] order", () => {
    const original = { lat: 12.9716, lng: 77.5946 };
    const strings = mapPointToInputStrings(original);
    const restored = inputStringsToMapPoint(strings.lat, strings.lng);
    expect(restored).toEqual(original);

    // Verify GeoJSON coordinate order is [lng, lat]
    const geoJson = validatePointInput(strings, "Test");
    expect(geoJson.ok).toBe(true);
    if (geoJson.ok) {
      expect(geoJson.point.coordinates).toEqual([77.5946, 12.9716]);
      expect(geoJson.point.type).toBe("Point");
    }
  });

  it("computes complete location selection only when pickup and drop-off are both set", () => {
    const pointA = { lat: 12.9716, lng: 77.5946 };
    const pointB = { lat: 12.9352, lng: 77.6245 };
    expect(hasCompleteLocationSelection(pointA, pointB)).toBe(true);
    expect(hasCompleteLocationSelection(pointA, null)).toBe(false);
    expect(hasCompleteLocationSelection(null, pointB)).toBe(false);
    expect(hasCompleteLocationSelection(null, null)).toBe(false);
  });

  it("builds a stable ride draft signature with trimmed and normalized values", () => {
    const signature = buildRideDraftSignature({
      pickupLat: " 12.9716 ",
      pickupLng: "77.5946",
      dropLat: "12.9352",
      dropLng: " 77.6245 ",
      paymentMethod: " wallet ",
      promoCode: " save10 ",
    });

    expect(signature).toBe("12.9716|77.5946|12.9352|77.6245|WALLET|SAVE10");
  });
});
