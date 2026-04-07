import { describe, expect, it } from "vitest";
import { createStompClient } from "../src/stomp-client";

describe("stomp client", () => {
  it("applies sane defaults and bearer auth normalization", () => {
    const client = createStompClient({
      baseURL: "http://localhost:8080",
      token: "abc123"
    });

    expect(client.reconnectDelay).toBe(5000);
    expect(client.heartbeatIncoming).toBe(10_000);
    expect(client.heartbeatOutgoing).toBe(10_000);
    expect(client.connectHeaders.Authorization).toBe("Bearer abc123");
    client.deactivate();
  });
});
