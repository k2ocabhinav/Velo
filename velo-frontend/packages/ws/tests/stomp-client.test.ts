import { describe, expect, it } from "vitest";
import { ReconnectionTimeMode } from "@stomp/stompjs";
import { createStompClient } from "../src/stomp-client";

describe("stomp client", () => {
  it("applies sane defaults without embedding authentication credentials", () => {
    const client = createStompClient({
      baseURL: "http://localhost:8080"
    });

    expect(client.reconnectDelay).toBe(5000);
    expect(client.maxReconnectDelay).toBe(60_000);
    expect(client.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);
    expect(client.heartbeatIncoming).toBe(10_000);
    expect(client.heartbeatOutgoing).toBe(10_000);
    expect(client.connectHeaders.Authorization).toBeUndefined();
    client.deactivate();
  });

  it("applies explicit reconnect and heartbeat options", () => {
    const client = createStompClient({
      baseURL: "http://localhost:8080",
      reconnectDelay: 4000,
      maxReconnectDelay: 1000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: 2000,
      heartbeatOutgoing: 3000,
      connectHeaders: {
        "X-Client": "driver",
      },
    });

    expect(client.reconnectDelay).toBe(4000);
    expect(client.maxReconnectDelay).toBe(4000);
    expect(client.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);
    expect(client.heartbeatIncoming).toBe(2000);
    expect(client.heartbeatOutgoing).toBe(3000);
    expect(client.connectHeaders.Authorization).toBeUndefined();
    expect(client.connectHeaders["X-Client"]).toBe("driver");
    client.deactivate();
  });

  it("normalizes max reconnect delay when lower than reconnect delay", () => {
    const client = createStompClient({
      baseURL: "http://localhost:8080",
      reconnectDelay: 4000,
      maxReconnectDelay: 1000,
    });

    expect(client.reconnectDelay).toBe(4000);
    expect(client.maxReconnectDelay).toBe(4000);
    client.deactivate();
  });
});
