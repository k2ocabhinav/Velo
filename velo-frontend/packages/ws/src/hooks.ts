import { useEffect, useMemo, useRef } from "react";
import type { Client } from "@stomp/stompjs";
import {
  parseNotificationEventMessage,
  parseRideUpdateEventMessage,
  type NotificationEvent,
  type RideUpdateEvent,
} from "./events";
import { registerStompSubscription } from "./subscription-registry";
import { createStompClient, type CreateStompClientOptions, type StompFrameHandler } from "./stomp-client";

export interface UseStompClientResult {
  client: Client;
  disconnect: () => void;
}

export function useStompClient(
  options: CreateStompClientOptions = {},
  dependencies: readonly unknown[] = [],
): UseStompClientResult {
  const client = useMemo(() => createStompClient(options), dependencies);

  useEffect(() => {
    client.activate();

    return () => {
      client.deactivate();
    };
  }, [client]);

  return {
    client,
    disconnect: () => client.deactivate(),
  };
}

export interface UseStompSubscriptionOptions {
  enabled?: boolean;
  destination: string;
  onMessage: StompFrameHandler;
}

export function useStompSubscription(
  client: Client | null,
  options: UseStompSubscriptionOptions,
): void {
  const latestHandler = useRef(options.onMessage);

  useEffect(() => {
    latestHandler.current = options.onMessage;
  }, [options.onMessage]);

  useEffect(() => {
    if (!client || !options.enabled) {
      return;
    }

    return registerStompSubscription(client, options.destination, (message) => {
      latestHandler.current(message);
    });
  }, [client, options.destination, options.enabled]);
}

export interface NotificationSubscriptionOptions {
  enabled?: boolean;
  onNotification: StompFrameHandler;
  onNotificationEvent?: (event: NotificationEvent) => void;
}

export function useNotificationSubscription(
  client: Client | null,
  options: NotificationSubscriptionOptions,
): void {
  useStompSubscription(client, {
    enabled: options.enabled ?? true,
    destination: "/user/queue/notifications",
    onMessage: (message) => {
      options.onNotification(message);
      if (!options.onNotificationEvent) {
        return;
      }
      const event = parseNotificationEventMessage(message);
      if (event) {
        options.onNotificationEvent(event);
      }
    },
  });
}

export interface RideUpdateSubscriptionOptions {
  enabled?: boolean;
  destination?: string;
  onRideUpdate: StompFrameHandler;
  onRideUpdateEvent?: (event: RideUpdateEvent) => void;
}

export function useRideUpdateSubscription(
  client: Client | null,
  options: RideUpdateSubscriptionOptions,
): void {
  useStompSubscription(client, {
    enabled: options.enabled ?? true,
    destination: options.destination ?? "/topic/ride-updates",
    onMessage: (message) => {
      options.onRideUpdate(message);
      if (!options.onRideUpdateEvent) {
        return;
      }
      const event = parseRideUpdateEventMessage(message);
      if (event) {
        options.onRideUpdateEvent(event);
      }
    },
  });
}
