import { useEffect, useMemo, useRef } from "react";
import type { Client, IMessage, IFrame } from "@stomp/stompjs";
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

    let subscription: { unsubscribe: () => void } | undefined;
    const previousOnConnect = client.onConnect;
    const subscribe = () => {
      subscription = client.subscribe(options.destination, (message: IMessage) => {
        latestHandler.current(message);
      });
    };

    if (client.connected) {
      subscribe();
    } else {
      client.onConnect = (frame: IFrame) => {
        previousOnConnect?.(frame);
        subscribe();
      };
    }

    return () => {
      subscription?.unsubscribe();
      client.onConnect = previousOnConnect;
    };
  }, [client, options.destination, options.enabled]);
}

export interface NotificationSubscriptionOptions {
  enabled?: boolean;
  onNotification: StompFrameHandler;
}

export function useNotificationSubscription(
  client: Client | null,
  options: NotificationSubscriptionOptions,
): void {
  useStompSubscription(client, {
    enabled: options.enabled ?? true,
    destination: "/user/queue/notifications",
    onMessage: options.onNotification,
  });
}

export interface RideUpdateSubscriptionOptions {
  enabled?: boolean;
  destination?: string;
  onRideUpdate: StompFrameHandler;
}

export function useRideUpdateSubscription(
  client: Client | null,
  options: RideUpdateSubscriptionOptions,
): void {
  useStompSubscription(client, {
    enabled: options.enabled ?? true,
    destination: options.destination ?? "/topic/ride-updates",
    onMessage: options.onRideUpdate,
  });
}
