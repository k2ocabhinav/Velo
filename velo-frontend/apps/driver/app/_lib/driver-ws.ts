"use client";

import { useEffect, useRef, useState } from "react";
import { ReconnectionTimeMode, type IFrame, type IMessage } from "@stomp/stompjs";
import { createStompClient, registerStompSubscription } from "@velo/ws";

const NOTIFICATIONS_DESTINATION = "/user/queue/notifications";

export interface DriverNotificationEvent {
  id?: number;
  title?: string;
  message?: string;
  type?: string;
  referenceId?: number | null;
  read?: boolean;
  createdTime?: string;
}

export type DriverWsConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface DriverNotificationSubscriptionState {
  state: DriverWsConnectionState;
  reconnectAttempts: number;
  lastError: string | null;
}

export function getDriverRealtimeStatusText(
  state: DriverWsConnectionState,
  reconnectAttempts: number,
): string {
  if (state === "connected") {
    return "Live updates connected.";
  }
  if (state === "connecting") {
    return "Connecting to live updates...";
  }
  if (state === "reconnecting") {
    return reconnectAttempts > 0
      ? `Reconnecting to live updates (attempt ${reconnectAttempts})...`
      : "Reconnecting to live updates...";
  }
  if (state === "error") {
    return "Live updates are degraded. New requests still refresh via API.";
  }

  return "Live updates are idle.";
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

function parseNotificationMessage(message: IMessage): DriverNotificationEvent | null {
  const body = message.body?.trim();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as DriverNotificationEvent;
  } catch {
    return null;
  }
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

const INITIAL_STATE: DriverNotificationSubscriptionState = {
  state: "idle",
  reconnectAttempts: 0,
  lastError: null,
};

export function useDriverNotificationSubscription(
  enabled: boolean,
  onNotification: (event: DriverNotificationEvent) => void,
): DriverNotificationSubscriptionState {
  const [connection, setConnection] = useState<DriverNotificationSubscriptionState>(INITIAL_STATE);
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
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
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

    const cleanupSubscription = registerStompSubscription(client, NOTIFICATIONS_DESTINATION, (message) => {
      const parsed = parseNotificationMessage(message);
      if (parsed) {
        latestHandler.current(parsed);
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
