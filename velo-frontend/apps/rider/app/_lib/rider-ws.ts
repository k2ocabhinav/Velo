"use client";

import { useEffect, useRef, useState } from "react";
import { createStompClient, parseNotificationEventMessage, registerStompSubscription } from "@velo/ws";
import type { IFrame, IMessage } from "@stomp/stompjs";
import { getRiderRealtimeStatusText, type RiderWsConnectionState } from "./rider-realtime-status";

const NOTIFICATIONS_DESTINATION = "/user/queue/notifications";

export interface RiderNotificationEvent {
  id?: number;
  title?: string;
  message?: string;
  type?: string;
  referenceId?: number | null;
  read?: boolean;
  createdTime?: string;
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

function parseNotificationId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
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
  const id = parseNotificationId(record.id);
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
    referenceId: parseNotificationId(record.referenceId) ?? null,
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

export { getRiderRealtimeStatusText, type RiderWsConnectionState };

const INITIAL_STATE: RiderNotificationSubscriptionState = {
  state: "idle",
  reconnectAttempts: 0,
  lastError: null,
};

export function useRiderNotificationSubscription(
  enabled: boolean,
  onNotification: (event: RiderNotificationEvent) => void,
): RiderNotificationSubscriptionState {
  const [connection, setConnection] = useState<RiderNotificationSubscriptionState>(INITIAL_STATE);
  const latestHandler = useRef(onNotification);

  useEffect(() => {
    latestHandler.current = onNotification;
  }, [onNotification]);

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

    const cleanupSubscription = registerStompSubscription(client, NOTIFICATIONS_DESTINATION, (message: IMessage) => {
      const parsed = parseNotificationEventMessage(message);
      const normalized = toRiderNotificationEvent(parsed);
      if (normalized) {
        latestHandler.current(normalized);
      }
    });

    client.activate();

    return () => {
      disposed = true;
      cleanupSubscription();
      void client.deactivate();
    };
  }, [enabled]);

  return connection;
}
