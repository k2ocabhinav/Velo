import type { Client, IFrame, IMessage } from "@stomp/stompjs";
import { describe, expect, it, vi } from "vitest";
import { parseNotificationEventMessage, parseRideUpdateEventMessage } from "../src/events";
import { registerStompSubscription } from "../src/subscription-registry";

interface MockSubscriptionRecord {
  destination: string;
  onMessage: (message: IMessage) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
  unsubscribed: boolean;
}

function createMessage(body: unknown): IMessage {
  return { body: JSON.stringify(body) } as IMessage;
}

function createClientHarness(initiallyConnected = false): {
  client: Client;
  records: MockSubscriptionRecord[];
  connect: () => void;
  emit: (destination: string, payload: unknown) => void;
  subscribeSpy: ReturnType<typeof vi.fn>;
} {
  const records: MockSubscriptionRecord[] = [];
  const subscribeSpy = vi.fn((destination: string, onMessage: (message: IMessage) => void) => {
    const record: MockSubscriptionRecord = {
      destination,
      onMessage,
      unsubscribed: false,
      unsubscribe: vi.fn(() => {
        record.unsubscribed = true;
      }),
    };
    records.push(record);
    return { unsubscribe: record.unsubscribe };
  });

  const client = {
    connected: initiallyConnected,
    onConnect: undefined,
    subscribe: subscribeSpy,
  } as unknown as Client;

  const connect = () => {
    client.connected = true;
    client.onConnect?.({} as IFrame);
  };

  const emit = (destination: string, payload: unknown) => {
    for (const record of records) {
      if (record.destination === destination && !record.unsubscribed) {
        record.onMessage(createMessage(payload));
      }
    }
  };

  return { client, records, connect, emit, subscribeSpy };
}

describe("subscription registry", () => {
  it("re-subscribes on reconnect and avoids duplicate active handlers", () => {
    const harness = createClientHarness(false);
    const onMessage = vi.fn();

    const cleanup = registerStompSubscription(harness.client, "/topic/ride-updates", onMessage);
    expect(harness.subscribeSpy).not.toHaveBeenCalled();

    harness.connect();
    expect(harness.subscribeSpy).toHaveBeenCalledTimes(1);

    harness.emit("/topic/ride-updates", { rideId: "r-1" });
    expect(onMessage).toHaveBeenCalledTimes(1);

    harness.connect();
    expect(harness.subscribeSpy).toHaveBeenCalledTimes(2);
    expect(harness.records[0]?.unsubscribe).toHaveBeenCalledTimes(1);
    expect(harness.records[0]?.unsubscribed).toBe(true);

    harness.emit("/topic/ride-updates", { rideId: "r-1", status: "DRIVER_ASSIGNED" });
    expect(onMessage).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("keeps a single active handler across repeated reconnect cycles", () => {
    const harness = createClientHarness(false);
    const onMessage = vi.fn();

    const cleanup = registerStompSubscription(harness.client, "/topic/ride-updates", onMessage);

    harness.connect();
    harness.connect();
    harness.connect();

    expect(harness.subscribeSpy).toHaveBeenCalledTimes(3);
    expect(harness.records).toHaveLength(3);
    expect(harness.records[0]?.unsubscribe).toHaveBeenCalledTimes(1);
    expect(harness.records[1]?.unsubscribe).toHaveBeenCalledTimes(1);
    expect(harness.records[2]?.unsubscribe).toHaveBeenCalledTimes(0);

    harness.emit("/topic/ride-updates", { rideId: "r-2", status: "ONGOING" });
    expect(onMessage).toHaveBeenCalledTimes(1);

    cleanup();
    expect(harness.records[2]?.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps registration and deregistration behavior correct for multiple handlers", () => {
    const harness = createClientHarness(true);
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const cleanupFirst = registerStompSubscription(harness.client, "/user/queue/notifications", firstHandler);
    const cleanupSecond = registerStompSubscription(harness.client, "/user/queue/notifications", secondHandler);

    expect(harness.subscribeSpy).toHaveBeenCalledTimes(1);

    harness.emit("/user/queue/notifications", { id: "n-1" });
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);

    cleanupFirst();
    harness.emit("/user/queue/notifications", { id: "n-2" });
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(2);

    cleanupSecond();
    expect(harness.records[0]?.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("parses typed notification and ride update events", () => {
    const notification = parseNotificationEventMessage(
      createMessage({ id: "n-1", type: "PROMO", message: "20% off" }),
    );
    const rideUpdate = parseRideUpdateEventMessage(
      createMessage({ rideId: "r-42", status: "ONGOING", etaMinutes: 5 }),
    );

    expect(notification).toEqual({
      id: "n-1",
      type: "PROMO",
      message: "20% off",
    });
    expect(rideUpdate).toEqual({
      rideId: "r-42",
      status: "ONGOING",
      etaMinutes: 5,
    });
    expect(parseNotificationEventMessage({ body: "not-json" } as IMessage)).toBeNull();
  });
});
