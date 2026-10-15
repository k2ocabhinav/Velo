import { describe, expect, it } from "vitest";
import type { IStompSocketMessageEvent } from "@stomp/stompjs";
import { SockJsSocket } from "../src/api/sockjs-socket.ts";

class FakeWebSocket {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<(event: { data?: unknown; code?: number; reason?: string }) => void>>();

  addEventListener(type: string, listener: (event: { data?: unknown; code?: number; reason?: string }) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.emit("close", { code: 1000, reason: "closed" });
  }

  message(data: string): void {
    this.emit("message", { data });
  }

  emit(type: string, event: { data?: unknown; code?: number; reason?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("SockJS WebSocket framing", () => {
  it("frames outgoing STOMP data and unwraps open, messages, heartbeat, and close frames", () => {
    const rawSocket = new FakeWebSocket();
    const socket = new SockJsSocket("ws://localhost/ws/websocket", () => rawSocket as unknown as WebSocket);
    let opened = 0;
    let closed = 0;
    const messages: string[] = [];
    socket.onopen = () => { opened += 1; };
    socket.onclose = () => { closed += 1; };
    socket.onmessage = (event: IStompSocketMessageEvent) => {
      if (typeof event.data === "string") {
        messages.push(event.data);
      }
    };

    rawSocket.readyState = 1;
    rawSocket.message("o");
    expect(opened).toBe(1);
    expect(socket.readyState).toBe(1);
    socket.send("CONNECT\naccept-version:1.2\n\n\u0000");
    expect(rawSocket.sent).toEqual([JSON.stringify(["CONNECT\naccept-version:1.2\n\n\u0000"])]);

    rawSocket.message(`a${JSON.stringify(["CONNECTED\nversion:1.2\n\n\u0000", "MESSAGE\n\nbody\u0000"])}`);
    rawSocket.message("h");
    expect(messages).toEqual(["CONNECTED\nversion:1.2\n\n\u0000", "MESSAGE\n\nbody\u0000", "\n"]);

    rawSocket.message(`c${JSON.stringify([3000, "server shutdown"])}`);
    expect(closed).toBe(1);
    expect(socket.readyState).toBe(3);
  });

  it("closes the underlying connection on malformed SockJS frames", () => {
    const rawSocket = new FakeWebSocket();
    const socket = new SockJsSocket("ws://localhost/ws/websocket", () => rawSocket as unknown as WebSocket);
    let errors = 0;
    socket.onerror = () => { errors += 1; };
    rawSocket.message("zunknown");
    expect(errors).toBe(1);
    expect(rawSocket.readyState).toBe(3);
  });
});
