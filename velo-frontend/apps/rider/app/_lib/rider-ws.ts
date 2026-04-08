"use client";

import { useEffect, useRef, useState } from "react";
import { createStompClient, parseNotificationEventMessage, parseRideUpdateEventMessage, registerStompSubscription } from "@velo/ws";
import type { IFrame, IMessage } from "@stomp/stompjs";
import { getRiderRealtimeStatusText, type RiderWsConnectionState } from "./rider-realtime-status";

const NOTIFICATIONS_DESTINATION = "/user/queue/notifications";
const RIDE_UPDATES_DESTINATION = "/user/queue/ride-updates";

export interface RiderNotificationEvent {
  id?: number;
  title?: string;
  message?: string;
  type?: string;
  referenceId?: number | null;
  read?: boolean;
  createdTime?: string;
}

export interface RiderRideUpdateEvent {
  eventType: "RIDE_STATUS_CHANGED" | "DRIVER_LOCATION_UPDATED" | "RIDE_COMPLETED" | "RIDE_CANCELLED";
  rideId?: number;
  rideRequestId?: number;
  status?: string;
  riderId?: number;
  driverId?: number;
  etaMinutes?: number | null;
  routePolyline?: string | null;
  updatedAt?: string;
  driverLocation?: {
    lat?: number;
    lng?: number;
    heading?: number | null;
    speedKph?: number | null;
    accuracyM?: number | null;
    capturedAt?: string | null;
  } | null;
}

export interface RiderNotificationSubscriptionState {
  state: RiderWsConnectionState;
  reconnectAttempts: number;
  lastError: string | null;
}

function getApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.VELO_API_BASE_URL ??
    "http://localhost:8080";

  return configured.replace(/\/$/, "");
}

function getSessionWsToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.sessionStorage.getItem("velo_ws_token");
  if (!token || !token.trim()) {
    return null;
  }

  return token;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toRiderNotificationEvent(event: unknown): RiderNotificationEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const record = event as Record<string, unknown>;
  const id = parseInteger(record.id);
  if (id === undefined || typeof record.title !== "string" || typeof record.message !== "string") {
    return null;
  }

  const createdTime =
    typeof record.createdTime === "string"
      ? record.createdTime
      : typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString();

  return {
    id,
    title: record.title,
    message: record.message,
    type: typeof record.type === "string" ? record.type : "GENERAL",
    referenceId: parseInteger(record.referenceId) ?? null,
    read: record.read === true,
    createdTime,
  };
}

function getFrameErrorMessage(frame: IFrame): string {
  const headerMessage = frame.headers?.message;
  if (typeof headerMessage === "string" && headerMessage.trim()) {
    return headerMessage;
  }

  const bodyMessage = frame.body?.trim();
  if (bodyMessage) {
    return bodyMessage;
  }

  return "Realtime connection failed.";
}

function isRideUpdateType(value: unknown): value is RiderRideUpdateEvent["eventType"] {
  return (
    value === "RIDE_STATUS_CHANGED" ||
    value === "DRIVER_LOCATION_UPDATED" ||
    value === "RIDE_COMPLETED" ||
    value === "RIDE_CANCELLED"
  );
}

export function normalizeRideUpdateEvent(event: unknown): RiderRideUpdateEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const record = event as Record<string, unknown>;
  if (!isRideUpdateType(record.eventType)) {
    return null;
  }

  const driverLocationRecord =
    record.driverLocation && typeof record.driverLocation === "object"
      ? (record.driverLocation as Record<string, unknown>)
      : null;

  const location =
    driverLocationRecord !== null
      ? {
          lat: parseNumber(driverLocationRecord.lat),
          lng: parseNumber(driverLocationRecord.lng),
          heading: parseNumber(driverLocationRecord.heading) ?? null,
          speedKph: parseNumber(driverLocationRecord.speedKph) ?? null,
          accuracyM: parseNumber(driverLocationRecord.accuracyM) ?? null,
          capturedAt: typeof driverLocationRecord.capturedAt === "string" ? driverLocationRecord.capturedAt : null,
        }
      : null;

  return {
    eventType: record.eventType,
    rideId: parseInteger(record.rideId),
    rideRequestId: parseInteger(record.rideRequestId),
    status: typeof record.status === "string" ? record.status : undefined,
    riderId: parseInteger(record.riderId),
    driverId: parseInteger(record.driverId),
    etaMinutes: parseInteger(record.etaMinutes) ?? null,
    routePolyline: typeof record.routePolyline === "string" ? record.routePolyline : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
    driverLocation: location,
  };
}

export function createRideUpdateEventDedupeKey(event: RiderRideUpdateEvent): string {
  const locationPart =
    event.driverLocation && typeof event.driverLocation.lat === "number" && typeof event.driverLocation.lng === "number"
      ? `${event.driverLocation.lat}:${event.driverLocation.lng}:${event.driverLocation.capturedAt ?? ""}`
      : "";

  return [
    event.eventType,
    event.rideId ?? "",
    event.rideRequestId ?? "",
    event.status ?? "",
    event.updatedAt ?? "",
    locationPart,
  ].join("|");
}

export { getRiderRealtimeStatusText, type RiderWsConnectionState };

const INITIAL_STATE: RiderNotificationSubscriptionState = {
  state: "idle",
  reconnectAttempts: 0,
  lastError: null,
};

function useRiderStompSubscription(
  enabled: boolean,
  destination: string,
  onMessage: (message: IMessage) => void,
): RiderNotificationSubscriptionState {
  const [connection, setConnection] = useState<RiderNotificationSubscriptionState>(INITIAL_STATE);
  const latestHandler = useRef(onMessage);

  useEffect(() => {
    latestHandler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      setConnection(INITIAL_STATE);
      return;
    }

    const token = getSessionWsToken();
    if (!token) {
      setConnection({
        state: "idle",
        reconnectAttempts: 0,
        lastError: "Realtime updates are unavailable until you sign in again.",
      });
      return;
    }

    let disposed = false;
    let hasConnected = false;
    let reconnectAttempts = 0;

    const client = createStompClient({
      baseURL: getApiBaseUrl(),
      token,
      reconnectDelay: 1_000,
      maxReconnectDelay: 30_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      beforeConnect: () => {
        if (disposed) {
          return;
        }

        if (!hasConnected) {
          setConnection({ state: "connecting", reconnectAttempts: 0, lastError: null });
          return;
        }

        reconnectAttempts += 1;
        setConnection((current) => ({
          state: "reconnecting",
          reconnectAttempts,
          lastError: current.lastError,
        }));
      },
      onConnect: () => {
        if (disposed) {
          return;
        }

        hasConnected = true;
        reconnectAttempts = 0;
        setConnection({ state: "connected", reconnectAttempts: 0, lastError: null });
      },
      onStompError: (frame) => {
        if (disposed) {
          return;
        }

        setConnection((current) => ({
          state: "error",
          reconnectAttempts: current.reconnectAttempts,
          lastError: getFrameErrorMessage(frame),
        }));
      },
      onWebSocketClose: () => {
        if (disposed || !hasConnected) {
          return;
        }

        setConnection((current) => ({
          state: "reconnecting",
          reconnectAttempts: current.reconnectAttempts,
          lastError: current.lastError,
        }));
      },
      onWebSocketError: () => {
        if (disposed) {
          return;
        }

        setConnection((current) => ({
          state: "error",
          reconnectAttempts: current.reconnectAttempts,
          lastError: "Realtime socket encountered a network error.",
        }));
      },
    });

    const cleanupSubscription = registerStompSubscription(client, destination, (message: IMessage) => {
      latestHandler.current(message);
    });

    client.activate();

    return () => {
      disposed = true;
      cleanupSubscription();
      void client.deactivate();
    };
  }, [destination, enabled]);

  return connection;
}

export function useRiderNotificationSubscription(
  enabled: boolean,
  onNotification: (event: RiderNotificationEvent) => void,
): RiderNotificationSubscriptionState {
  return useRiderStompSubscription(enabled, NOTIFICATIONS_DESTINATION, (message) => {
    const parsed = parseNotificationEventMessage(message);
    const normalized = toRiderNotificationEvent(parsed);
    if (normalized) {
      onNotification(normalized);
    }
  });
}

export function useRiderRideUpdatesSubscription(
  enabled: boolean,
  onUpdate: (event: RiderRideUpdateEvent) => void,
): RiderNotificationSubscriptionState {
  const lastEventKeyRef = useRef<string | null>(null);

  return useRiderStompSubscription(enabled, RIDE_UPDATES_DESTINATION, (message) => {
    const parsed = parseRideUpdateEventMessage(message);
    const normalized = normalizeRideUpdateEvent(parsed);
    if (!normalized) {
      return;
    }

    const dedupeKey = createRideUpdateEventDedupeKey(normalized);
    if (lastEventKeyRef.current === dedupeKey) {
      return;
    }

    lastEventKeyRef.current = dedupeKey;
    onUpdate(normalized);
  });
}
