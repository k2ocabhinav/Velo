import { describe, expect, it, vi } from "vitest";
import { EventHub, type SimEvent } from "../../src/control/event-hub.ts";

describe("EventHub", () => {
  it("assigns increasing ids and an ISO timestamp", () => {
    const hub = new EventHub();
    const first = hub.publish({ type: "trip.requested", message: "one" });
    const second = hub.publish({ type: "trip.accepted", message: "two" });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(Number.isNaN(Date.parse(first.at))).toBe(false);
    expect(first.at).toBe(new Date(first.at).toISOString());
  });

  it("carries the tenant and data payload through", () => {
    const hub = new EventHub();
    const event = hub.publish({
      type: "trip.requested",
      tenant: "saffron-routes",
      message: "Guest requested",
      data: { rideRequestId: 52 },
    });

    expect(event.tenant).toBe("saffron-routes");
    expect(event.data).toEqual({ rideRequestId: 52 });
  });

  it("keeps only the most recent 300 events", () => {
    const hub = new EventHub();
    for (let i = 0; i < 305; i += 1) hub.publish({ type: "tick", message: `#${i}` });

    const recent = hub.recent();
    expect(recent).toHaveLength(300);
    expect(recent[0]?.id).toBe(6);
    expect(recent.at(-1)?.id).toBe(305);
  });

  it("replays events after a given id", () => {
    const hub = new EventHub();
    for (let i = 0; i < 5; i += 1) hub.publish({ type: "tick", message: `#${i}` });

    expect(hub.recent(2).map((event) => event.id)).toEqual([3, 4, 5]);
    expect(hub.recent(0)).toHaveLength(5);
    expect(hub.recent(5)).toEqual([]);
  });

  it("delivers to subscribers and stops after unsubscribe", () => {
    const hub = new EventHub();
    const received: SimEvent[] = [];
    const unsubscribe = hub.subscribe((event) => received.push(event));

    hub.publish({ type: "a", message: "1" });
    unsubscribe();
    hub.publish({ type: "b", message: "2" });

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe("a");
  });

  it("isolates a throwing subscriber from the others", () => {
    const hub = new EventHub();
    const healthy = vi.fn();

    hub.subscribe(() => {
      throw new Error("boom");
    });
    hub.subscribe(healthy);

    expect(() => hub.publish({ type: "a", message: "1" })).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("allows a subscriber to unsubscribe during delivery", () => {
    const hub = new EventHub();
    const later = vi.fn();
    const unsubscribe = hub.subscribe(() => unsubscribe());

    expect(() => hub.publish({ type: "a", message: "1" })).not.toThrow();
    hub.subscribe(later);
    hub.publish({ type: "b", message: "2" });

    expect(later).toHaveBeenCalledTimes(1);
  });

  it("returns an independent snapshot from recent()", () => {
    const hub = new EventHub();
    hub.publish({ type: "a", message: "1" });

    const snapshot = hub.recent();
    snapshot.push({ id: 99, at: "x", type: "b", message: "2" });

    expect(hub.recent()).toHaveLength(1);
  });
});
