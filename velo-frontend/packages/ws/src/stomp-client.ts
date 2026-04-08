import {
  Client,
  ReconnectionTimeMode,
  type IMessage,
  type IFrame,
  type StompSubscription,
  type StompConfig,
} from "@stomp/stompjs";
import SockJS from "sockjs-client";

export interface CreateStompClientOptions {
  baseURL?: string;
  endpoint?: string;
  token?: string | null;
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
  const token = options.token ? (options.token.startsWith("Bearer ") ? options.token : `Bearer ${options.token}`) : undefined;
  const reconnectDelay = options.reconnectDelay ?? 5000;
  const maxReconnectDelay = Math.max(options.maxReconnectDelay ?? 60_000, reconnectDelay);

  const config: StompConfig = {
    webSocketFactory: options.webSocketFactory ?? createSockJsFactory(socketUrl),
    connectHeaders: {
      ...(token ? { Authorization: token } : {}),
      ...options.connectHeaders,
    },
    reconnectDelay,
    maxReconnectDelay,
    reconnectTimeMode: options.reconnectTimeMode ?? ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: options.heartbeatIncoming ?? 10000,
    heartbeatOutgoing: options.heartbeatOutgoing ?? 10000,
  };

  if (options.beforeConnect) {
    config.beforeConnect = options.beforeConnect;
  }
  if (options.onConnect) {
    config.onConnect = options.onConnect;
  }
  if (options.onStompError) {
    config.onStompError = options.onStompError;
  }
  if (options.onWebSocketClose) {
    config.onWebSocketClose = options.onWebSocketClose;
  }
  if (options.onWebSocketError) {
    config.onWebSocketError = options.onWebSocketError;
  }

  if (options.debug) {
    config.debug = (message: string) => console.debug(`[stomp] ${message}`);
  }

  return new Client(config);
}

export type StompFrameHandler = (message: IMessage) => void;
export type StompConnectHandler = (frame: IFrame) => void;
export type StompSubscriptionHandle = StompSubscription;
