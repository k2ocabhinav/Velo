import { describe, expect, it } from "vitest";
import type { Client } from "@stomp/stompjs";
import { StompSession } from "../src/api/stomp-session.ts";
import { FakeApi, FakeClock } from "./helpers.ts";
import type { RandomSource } from "../src/sim/random.ts";

class FakeClient {
  connected = false;
  onConnect?: () => void;
  onWebSocketClose?: (event: CloseEvent) => void;
  onWebSocketError?: (event: Event) => void;
  onStompError?: () => void;
  readonly subscriptions: string[] = [];

  activate(): void {
    this.connected = true;
    queueMicrotask(() => this.onConnect?.());
  }

  async deactivate(): Promise<void> {
    this.connected = false;
  }

  subscribe(destination: string): { unsubscribe(): void } {
    this.subscriptions.push(destination);
    return { unsubscribe: () => undefined };
  }

  drop(): void {
    this.connected = false;
    this.onWebSocketClose?.({} as CloseEvent);
  }
}

describe("STOMP ticket and reconnect lifecycle", () => {
  it("gets a new ticket and reinstalls subscriptions after a jittered reconnect", async () => {
    const api = new FakeApi();
    const clock = new FakeClock();
    const clients: FakeClient[] = [];
    const random: RandomSource = { next: () => 0 };
    let reconnects = 0;
    const session = new StompSession({
      api,
      webSocketUrl: "ws://localhost:8080/ws/websocket",
      clock,
      random,
      onReconnect: () => { reconnects += 1; },
      clientFactory: () => {
        const client = new FakeClient();
        clients.push(client);
        return client as unknown as Client;
      },
    });
    session.subscribe("/user/queue/ride-updates", () => undefined);

    await session.connect();
    await Promise.resolve();
    expect(clients[0]?.subscriptions).toEqual(["/user/queue/ride-updates"]);
    clients[0]?.drop();
    await waitFor(() => clients.length === 2);
    await Promise.resolve();
    clients[1]?.drop();
    await waitFor(() => clients.length === 3);
    await Promise.resolve();

    expect(api.calls.filter((call) => call === "ticket")).toHaveLength(3);
    expect(clients[2]?.subscriptions).toEqual(["/user/queue/ride-updates"]);
    expect(reconnects).toBe(2);
    expect(clock.sleeps).toContain(750);
    expect(clock.sleeps).toContain(1_500);
    await session.close();
  });
});

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20 && !condition(); attempt += 1) {
    await Promise.resolve();
  }
  if (!condition()) {
    throw new Error("Condition was not reached before the test timeout");
  }
}
