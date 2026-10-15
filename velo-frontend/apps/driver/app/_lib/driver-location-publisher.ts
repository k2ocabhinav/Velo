"use client";

import { useCallback, useEffect, useState } from "react";
import { requestDriverProxy } from "./driver-client";
import type { MapPoint } from "./map/routing";

type DriverLocationPublisherState = {
  mode: "idle" | "publishing" | "degraded";
  message: string;
  permissionDenied: boolean;
  lastPublishedAt: string | null;
  lastPublishedPoint: MapPoint | null;
};

export type DriverLocationPublisher = DriverLocationPublisherState & {
  retry: () => void;
};

const ACTIVE_RIDE_STATUSES = new Set(["CONFIRMED", "ONGOING"]);

type PublishIntervalInput = {
  rideStatus: string | null | undefined;
  speedKph: number | null | undefined;
  online?: boolean;
  reconnecting?: boolean;
};

export function resolveLocationPublishIntervalMs({ rideStatus, speedKph, online = false, reconnecting = false }: PublishIntervalInput): number {
  const normalizedStatus = (rideStatus ?? "").toUpperCase();
  if (ACTIVE_RIDE_STATUSES.has(normalizedStatus)) {
    if (reconnecting) return 10_000;
    if (typeof speedKph === "number" && Number.isFinite(speedKph) && speedKph >= 2) return 3_000;
    return 10_000;
  }

  if (online) return reconnecting ? 30_000 : 25_000;
  return 0;
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

function isLocationPublishingEnabled(status: string | null | undefined, online: boolean): boolean {
  return online || ACTIVE_RIDE_STATUSES.has((status ?? "").toUpperCase());
}

export function useDriverLocationPublisher(
  rideStatus: string | null | undefined,
  online = false,
  tripLabel = "Trip",
): DriverLocationPublisher {
  const [state, setState] = useState<DriverLocationPublisherState>({
    mode: "idle",
    message: "Location publishing is idle.",
    permissionDenied: false,
    lastPublishedAt: null,
    lastPublishedPoint: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isLocationPublishingEnabled(rideStatus, online)) {
      setState({
        mode: "idle",
        message: "Location publishing is idle.",
        permissionDenied: false,
        lastPublishedAt: null,
        lastPublishedPoint: null,
      });
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setState({
        mode: "degraded",
        message: `Live location isn't available in this browser. ${tripLabel} updates still work.`,
        permissionDenied: false,
        lastPublishedAt: null,
        lastPublishedPoint: null,
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
      if (disposed || !isLocationPublishingEnabled(rideStatus, online)) {
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
                permissionDenied: false,
                lastPublishedAt: publishedAt,
                lastPublishedPoint: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                },
              }));
              scheduleNext(
                resolveLocationPublishIntervalMs({
                  rideStatus,
                  speedKph,
                  online,
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
                message: "Live location paused. Retrying shortly.",
              }));
              scheduleNext(
                resolveLocationPublishIntervalMs({
                  rideStatus,
                  speedKph,
                  online,
                  reconnecting: true,
                }),
              );
            });
        },
        (geoError) => {
          if (disposed) {
            return;
          }

          const permissionDenied = geoError.code === geoError.PERMISSION_DENIED;
          setState((current) => ({
            ...current,
            mode: "degraded",
            message: permissionDenied
              ? `Live location is off. ${tripLabel} updates still work.`
              : "Can't read your location right now. Retrying shortly.",
            permissionDenied,
          }));
          scheduleNext(
            resolveLocationPublishIntervalMs({
              rideStatus,
              speedKph: null,
              online,
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
  }, [attempt, online, rideStatus, tripLabel]);

  return { ...state, retry };
}
