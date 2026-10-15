import { describe, expect, it, vi } from "vitest";
import {
  buildFallbackRoutePath,
  buildOsrmRouteUrl,
  fetchRoutePath,
  parseOsrmRouteResponse,
  type MapPoint,
} from "../app/_lib/map/routing";

const START: MapPoint = { lat: 12.9716, lng: 77.5946 };
const END: MapPoint = { lat: 12.9352, lng: 77.6245 };

describe("rider map routing adapter", () => {
  it("parses OSRM routes into map points", () => {
    const route = parseOsrmRouteResponse({
      code: "Ok",
      routes: [
        {
          distance: 1200,
          duration: 480,
          geometry: {
            coordinates: [
              [77.5946, 12.9716],
              [77.61, 12.955],
              [77.6245, 12.9352],
            ],
          },
        },
      ],
    });

    expect(route).toEqual({
      points: [
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.955, lng: 77.61 },
        { lat: 12.9352, lng: 77.6245 },
      ],
      distanceMeters: 1200,
      durationSeconds: 480,
      encodedPolyline: null,
    });
  });

  it("falls back to straight line when payload is invalid", () => {
    expect(parseOsrmRouteResponse({ code: "NoRoute", routes: [] })).toBeNull();

    expect(buildFallbackRoutePath(START, END)).toEqual({
      points: [START, END],
      distanceMeters: null,
      durationSeconds: null,
      encodedPolyline: null,
    });
  });

  it("builds provider URL and handles fetch failures with fallback", async () => {
    const url = buildOsrmRouteUrl(START, END, {
      baseUrl: "https://router.project-osrm.org",
      profile: "driving",
    });
    expect(url).toContain("/route/v1/driving/77.5946,12.9716;77.6245,12.9352");

    const failingFetch = vi.fn().mockRejectedValue(new Error("network"));
    const fallback = await fetchRoutePath(START, END, failingFetch as unknown as typeof fetch, {
      baseUrl: "https://router.project-osrm.org",
      profile: "driving",
    });

    expect(fallback.points).toEqual([START, END]);
  });

  it("aborts a slow route request and falls back to a straight line", async () => {
    const hangingFetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const route = await fetchRoutePath(
      START,
      END,
      hangingFetch as unknown as typeof fetch,
      { baseUrl: "https://router.project-osrm.org", profile: "driving" },
      5,
    );

    expect(route.points).toEqual([START, END]);
    expect(route.distanceMeters).toBeNull();
    expect(route.durationSeconds).toBeNull();
  });
});
