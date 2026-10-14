import {
  Client,
  ReconnectionTimeMode,
  type IMessage,
  type IFrame,
  type StompSubscription,
  type StompConfig,
} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { ExponentialReconnectBackoff } from "./reconnect-backoff";

export interface CreateStompClientOptions {
  baseURL?: string;
  endpoint?: string;
  connectHeaders?: Record<string, string>;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectTimeMode?: ReconnectionTimeMode;
  heartbeatIncoming?: number;
  heartbeatOutgoing?: number;
  beforeConnect?: StompConfig["beforeConnect"];
  onConnect?: StompConfig["onConnect"];
  onStompError?: StompConfig["onStompError"];
  onWebSocketClose?: StompConfig["onWebSocketClose"];
  onWebSocketError?: StompConfig["onWebSocketError"];
  debug?: boolean;
  webSocketFactory?: () => WebSocket;
}

function normalizeEndpoint(baseURL: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  return new URL(endpoint, baseURL).toString();
}

function createSockJsFactory(url: string): () => WebSocket {
  return () => new SockJS(url) as unknown as WebSocket;
}

export function createStompClient(options: CreateStompClientOptions = {}): Client {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const baseURL = options.baseURL ?? runtime.process?.env?.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  const endpoint = options.endpoint ?? "/ws";
  const socketUrl = normalizeEndpoint(baseURL, endpoint);
  const reconnectDelay = options.reconnectDelay ?? 5000;
  const maxReconnectDelay = Math.max(options.maxReconnectDelay ?? 60_000, reconnectDelay);
  const backoff = new ExponentialReconnectBackoff({
    initialDelayMs: reconnectDelay,
    maxDelayMs: maxReconnectDelay,
  });

  const config: StompConfig = {
    webSocketFactory: options.webSocketFactory ?? createSockJsFactory(socketUrl),
    connectHeaders: {
      ...options.connectHeaders,
    },
    // STOMP's built-in exponential timer has no jitter. Retry scheduling below keeps
    // the same cap while spreading reconnects across clients.
    reconnectDelay: 0,
    maxReconnectDelay,
    reconnectTimeMode: options.reconnectTimeMode ?? ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: options.heartbeatIncoming ?? 10000,
    heartbeatOutgoing: options.heartbeatOutgoing ?? 10000,
  };

  if (options.beforeConnect) {
    config.beforeConnect = options.beforeConnect;
  }
  if (options.onStompError) {
    config.onStompError = options.onStompError;
  }
  if (options.onWebSocketError) {
    config.onWebSocketError = options.onWebSocketError;
  }

  if (options.debug) {
    config.debug = (message: string) => console.debug(`[stomp] ${message}`);
  }

  const client = new Client(config);
  const activate = client.activate.bind(client);
  const deactivate = client.deactivate.bind(client);
  let shouldStayActive = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  client.onConnect = (frame) => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    backoff.reset();
    options.onConnect?.(frame);
  };

  client.onWebSocketClose = (event) => {
    options.onWebSocketClose?.(event);
    if (!shouldStayActive || !client.active) return;

    // Mark the client inactive before STOMP's close handler considers its own
    // retry path. Reactivate after our jittered delay instead.
    void deactivate().then(() => {
      if (!shouldStayActive) return;
      const delay = backoff.nextDelay();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        if (shouldStayActive) activate();
      }, delay);
    });
  };

  client.activate = () => {
    if (!shouldStayActive) backoff.reset();
    shouldStayActive = true;
    activate();
  };

  client.deactivate = async (deactivateOptions) => {
    shouldStayActive = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    backoff.reset();
    await deactivate(deactivateOptions);
  };

  return client;
}

export type StompFrameHandler = (message: IMessage) => void;
export type StompConnectHandler = (frame: IFrame) => void;
export type StompSubscriptionHandle = StompSubscription;
