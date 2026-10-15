import type { IStompSocket, IStompSocketMessageEvent } from "@stomp/stompjs";

export type WebSocketFactory = (url: string) => WebSocket;

export class SockJsSocket implements IStompSocket {
  onclose: IStompSocket["onclose"] = null;
  onerror: IStompSocket["onerror"] = null;
  onmessage: IStompSocket["onmessage"] = null;
  onopen: IStompSocket["onopen"] = null;
  binaryType = "arraybuffer";
  private sockJsOpen = false;
  private closeNotified = false;
  private readonly socket: WebSocket;
  readonly url: string;

  constructor(url: string, socketFactory: WebSocketFactory = (target) => new WebSocket(target)) {
    this.url = url;
    this.socket = socketFactory(url);
    this.socket.addEventListener("message", (event) => this.handleFrame(event.data));
    this.socket.addEventListener("error", (event) => this.onerror?.(event));
    this.socket.addEventListener("close", (event) => this.notifyClose(event));
  }

  get readyState(): number {
    if (this.closeNotified || this.socket.readyState === WebSocket.CLOSED) {
      return WebSocket.CLOSED;
    }
    if (this.socket.readyState === WebSocket.CLOSING) {
      return WebSocket.CLOSING;
    }
    return this.sockJsOpen ? WebSocket.OPEN : WebSocket.CONNECTING;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data !== "string") {
      throw new TypeError("SockJS STOMP messages must be text frames");
    }
    this.socket.send(JSON.stringify([data]));
  }

  close(): void {
    this.socket.close();
  }

  private handleFrame(data: unknown): void {
    if (typeof data !== "string" || data.length === 0) {
      this.fail("SockJS sent an empty or non-text frame");
      return;
    }
    const frameType = data[0];
    if (frameType === "o" && data.length === 1) {
      this.sockJsOpen = true;
      this.onopen?.();
      return;
    }
    if (frameType === "h" && data.length === 1) {
      this.deliver("\n");
      return;
    }
    if (frameType === "a") {
      this.handleMessages(data.slice(1));
      return;
    }
    if (frameType === "c") {
      this.handleCloseFrame(data.slice(1));
      return;
    }
    this.fail("SockJS sent an unknown frame");
  }

  private handleMessages(json: string): void {
    let messages: unknown;
    try {
      messages = JSON.parse(json) as unknown;
    } catch {
      this.fail("SockJS sent malformed message data");
      return;
    }
    if (!Array.isArray(messages) || !messages.every((message) => typeof message === "string")) {
      this.fail("SockJS message data must be an array of strings");
      return;
    }
    for (const message of messages) {
      this.deliver(message);
    }
  }

  private handleCloseFrame(json: string): void {
    let details: unknown;
    try {
      details = JSON.parse(json) as unknown;
    } catch {
      this.fail("SockJS sent malformed close data");
      return;
    }
    if (!Array.isArray(details) || typeof details[0] !== "number" || typeof details[1] !== "string") {
      this.fail("SockJS close data is invalid");
      return;
    }
    this.notifyClose({ code: details[0], reason: details[1] });
    this.socket.close();
  }

  private deliver(data: string): void {
    const event: IStompSocketMessageEvent = { data };
    this.onmessage?.(event);
  }

  private fail(message: string): void {
    this.onerror?.(new Error(message));
    this.socket.close();
  }

  private notifyClose(event: { code?: number; reason?: string }): void {
    if (this.closeNotified) {
      return;
    }
    this.closeNotified = true;
    this.onclose?.(event);
  }
}
