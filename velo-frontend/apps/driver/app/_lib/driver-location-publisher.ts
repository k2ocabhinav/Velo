"use client";

import { useEffect, useState } from "react";
import { requestDriverProxy } from "./driver-client";

type DriverLocationPublisherState = {
  mode: "idle" | "publishing" | "degraded";
  message: string;
  lastPublishedAt: string | null;
};

const ACTIVE_RIDE_STATUSES = new Set(["CONFIRMED", "ONGOING"]);

type PublishIntervalInput = {
  rideStatus: string | null | undefined;
  speedKph: number | null | undefined;
  reconnecting?: boolean;
};

export function resolveLocationPublishIntervalMs({
  rideStatus,
  speedKph,
  reconnecting = false,
}: PublishIntervalInput): number {
  const normalizedStatus = (rideStatus ?? "").toUpperCase();
  if (!ACTIVE_RIDE_STATUSES.has(normalizedStatus)) {
    return 0;
  }

  if (reconnecting) {
    return 10_000;
  }

  if (typeof speedKph === "number" && Number.isFinite(speedKph) && speedKph >= 2) {
    return 3_000;
  }

  return 10_000;
}

function toHeading(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function toSpeedKph(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value * 3.6;
}

function toAccuracy(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function isLocationPublishingEnabled(status: string | null | undefined): boolean {
  return ACTIVE_RIDE_STATUSES.has((status ?? "").toUpperCase());
}

export function useDriverLocationPublisher(rideStatus: string | null | undefined): DriverLocationPublisherState {
  const [state, setState] = useState<DriverLocationPublisherState>({
    mode: "idle",
    message: "Location publishing is idle.",
    lastPublishedAt: null,
  });

  useEffect(() => {
    if (!isLocationPublishingEnabled(rideStatus)) {
      setState({
        mode: "idle",
        message: "Location publishing is idle.",
        lastPublishedAt: null,
      });
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setState({
        mode: "degraded",
        message: "Geolocation is unavailable. Ride status updates continue without live location.",
        lastPublishedAt: null,
      });
      return;
    }

    let disposed = false;
    let timeoutId: number | null = null;

    const scheduleNext = (delayMs: number) => {
      if (disposed) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        void publishCurrentLocation();
      }, delayMs);
    };

    const publishCurrentLocation = async (): Promise<void> => {
      if (disposed || !isLocationPublishingEnabled(rideStatus)) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const speedKph = toSpeedKph(position.coords.speed);
          const heading = toHeading(position.coords.heading);
          const accuracyM = toAccuracy(position.coords.accuracy);
          const capturedAt = new Date(position.timestamp).toISOString();

          void requestDriverProxy("drivers/location", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading,
              speedKph,
              accuracyM,
              capturedAt,
            }),
          })
            .then(() => {
              if (disposed) {
                return;
              }

              const publishedAt = new Date().toISOString();
              setState((current) => ({
                ...current,
                mode: "publishing",
                message: "Publishing live location updates.",
                lastPublishedAt: publishedAt,
              }));
              scheduleNext(
                resolveLocationPublishIntervalMs({
                  rideStatus,
                  speedKph,
                }),
              );
            })
            .catch(() => {
              if (disposed) {
                return;
              }

              setState((current) => ({
                ...current,
                mode: "degraded",
                message: "Location publish failed. Retrying with slower cadence.",
              }));
              scheduleNext(
                resolveLocationPublishIntervalMs({
                  rideStatus,
                  speedKph,
                  reconnecting: true,
                }),
              );
            });
        },
        (geoError) => {
          if (disposed) {
            return;
          }

          const message =
            geoError.code === geoError.PERMISSION_DENIED
              ? "Location permission denied. Ride status updates continue without live location."
              : "Unable to read location right now. Retrying with slower cadence.";
          setState((current) => ({
            ...current,
            mode: "degraded",
            message,
          }));
          scheduleNext(
            resolveLocationPublishIntervalMs({
              rideStatus,
              speedKph: null,
              reconnecting: true,
            }),
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 8_000,
          maximumAge: 2_000,
        },
      );
    };

    void publishCurrentLocation();

    return () => {
      disposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [rideStatus]);

  return state;
}
