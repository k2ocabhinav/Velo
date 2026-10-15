import { Client, type IMessage } from "@stomp/stompjs";
import type { SimApi } from "./http-client.ts";
import type { Clock } from "../sim/clock.ts";
import type { RandomSource } from "../sim/random.ts";

export type StompMessageHandler = (body: string) => void;

export interface StompSessionOptions {
  api: SimApi;
  webSocketUrl: string;
  clock: Clock;
  random: RandomSource;
  onReconnect?: () => void;
  clientFactory?: (webSocketUrl: string, ticket: string) => Client;
}

export class StompSession {
  private readonly subscriptions = new Map<string, Set<StompMessageHandler>>();
  private readonly stopController = new AbortController();
  private client: Client | null = null;
  private stopped = false;
  private reconnectCount = 0;
  private openedBefore = false;
  private loopPromise: Promise<void> | null = null;
  private closeConnection: (() => void) | null = null;
  private readonly options: StompSessionOptions;

  constructor(options: StompSessionOptions) {
    this.options = options;
  }

  connect(): Promise<void> {
    if (!this.loopPromise) {
      this.loopPromise = this.runConnectionLoop();
    }
    return this.waitUntilConnected();
  }

  subscribe(destination: string, handler: StompMessageHandler): () => void {
    let handlers = this.subscriptions.get(destination);
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(destination, handlers);
    }
    handlers.add(handler);
    if (this.client?.connected) {
      this.installSubscription(this.client, destination, handler);
    }
    return () => {
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        this.subscriptions.delete(destination);
      }
    };
  }

  async close(): Promise<void> {
    this.stopped = true;
    this.stopController.abort(new Error("STOMP session is closing"));
    this.closeConnection?.();
    const client = this.client;
    this.client = null;
    if (client) {
      await client.deactivate({ force: true });
    }
  }

  private async waitUntilConnected(): Promise<void> {
    const startedAt = this.options.clock.now();
    while (!this.stopped && !this.client?.connected) {
      if (this.options.clock.now() - startedAt > 45_000) {
        throw new Error("Timed out connecting to the ride WebSocket");
      }
      await this.options.clock.sleep(100, this.stopController.signal);
    }
    if (this.stopped) {
      throw new Error("STOMP session stopped before connecting");
    }
  }

  private async runConnectionLoop(): Promise<void> {
    while (!this.stopped) {
      let connectedAt: number | null = null;
      try {
        const disconnected = await this.openConnection();
        connectedAt = this.options.clock.now();
        await disconnected;
      } catch {
        // The backoff loop owns reconnect timing; transport details are not logged with credentials.
      }
      if (connectedAt !== null && this.options.clock.now() - connectedAt >= 30_000) {
        this.reconnectCount = 0;
      }
      const client = this.client;
      this.client = null;
      if (client) {
        await client.deactivate({ force: true }).catch(() => undefined);
      }
      if (!this.stopped) {
        if (this.openedBefore) {
          this.options.onReconnect?.();
        }
        const delay = this.nextReconnectDelay();
        this.reconnectCount += 1;
        try {
          await this.options.clock.sleep(delay, this.stopController.signal);
        } catch {
          return;
        }
      }
    }
  }

  private async openConnection(): Promise<Promise<void>> {
    const { ticket } = await this.options.api.getWebSocketTicket(this.stopController.signal);
    if (this.stopped) {
      throw new Error("STOMP session is closed");
    }
    const client = this.options.clientFactory?.(this.options.webSocketUrl, ticket) ?? new Client({
      webSocketFactory: () => new WebSocket(this.options.webSocketUrl),
      connectHeaders: { Authorization: `Bearer ${ticket}` },
      reconnectDelay: 0,
      connectionTimeout: 12_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      debug: () => undefined,
    });
    this.client = client;

    return new Promise<Promise<void>>((resolve, reject) => {
      let connected = false;
      let closed = false;
      let resolveClosed: () => void = () => {};
      const disconnected = new Promise<void>((done) => {
        resolveClosed = done;
      });
      const finishClose = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (!connected) {
          reject(new Error("WebSocket closed before STOMP connected"));
        } else {
          resolveClosed();
        }
      };
      this.closeConnection = finishClose;
      client.onConnect = () => {
        connected = true;
        this.openedBefore = true;
        this.installAllSubscriptions(client);
        resolve(disconnected);
      };
      client.onWebSocketClose = () => finishClose();
      client.onWebSocketError = () => finishClose();
      client.onStompError = () => finishClose();
      client.activate();
    });
  }

  private installAllSubscriptions(client: Client): void {
    for (const [destination, handlers] of this.subscriptions) {
      for (const handler of handlers) {
        this.installSubscription(client, destination, handler);
      }
    }
  }

  private installSubscription(client: Client, destination: string, handler: StompMessageHandler): void {
    client.subscribe(destination, (message: IMessage) => handler(message.body));
  }

  private nextReconnectDelay(): number {
    const ceiling = Math.min(30_000, 1_000 * 2 ** Math.min(this.reconnectCount, 5));
    return Math.min(30_000, Math.round(ceiling * (0.75 + this.options.random.next() * 0.5)));
  }
}
