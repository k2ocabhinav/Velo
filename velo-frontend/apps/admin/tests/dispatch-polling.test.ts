// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminLiveDispatchSnapshotDto } from "@velo/api/types";
import {
  getLiveDispatchRetryDelay,
  LIVE_DISPATCH_MAX_BACKOFF_MS,
  LIVE_DISPATCH_POLL_MS,
  type LiveDispatchFetcher,
  useLiveDispatch,
} from "../app/(protected)/dispatch/_components/use-live-dispatch";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type HarnessProps = { fetchSnapshot: LiveDispatchFetcher; report: (snapshot: ReturnType<typeof useLiveDispatch>) => void };
let latest: ReturnType<typeof useLiveDispatch> | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Harness({ fetchSnapshot, report }: HarnessProps): ReactNode {
  latest = useLiveDispatch(fetchSnapshot);
  report(latest);
  return null;
}

const sampleSnapshot: AdminLiveDispatchSnapshotDto = {
  generatedAt: "2026-10-15T10:00:00",
  drivers: [],
  rides: [],
};

async function mountHook(fetchSnapshot: LiveDispatchFetcher): Promise<void> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(Harness, { fetchSnapshot, report: () => undefined }));
  });
}

async function unmountHook(): Promise<void> {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  latest = null;
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function changeVisibility(state: DocumentVisibilityState): Promise<void> {
  await act(async () => {
    setVisibility(state);
    await Promise.resolve();
  });
}

afterEach(async () => {
  await unmountHook();
  vi.useRealTimers();
  setVisibility("visible");
});

describe("live dispatch polling", () => {
  it("polls immediately, pauses while hidden, and resumes as soon as visible", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const fetchSnapshot = vi.fn(async () => sampleSnapshot);
    await mountHook(fetchSnapshot);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(LIVE_DISPATCH_POLL_MS));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);

    await changeVisibility("hidden");
    await act(async () => vi.advanceTimersByTimeAsync(LIVE_DISPATCH_POLL_MS * 3));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);

    await changeVisibility("visible");
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  });

  it("never overlaps a poll when the request takes longer than the polling interval", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const resolvers: Array<(snapshot: AdminLiveDispatchSnapshotDto) => void> = [];
    const fetchSnapshot: LiveDispatchFetcher = vi.fn(() => new Promise<AdminLiveDispatchSnapshotDto>((resolve) => resolvers.push(resolve)));
    await mountHook(fetchSnapshot);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(LIVE_DISPATCH_POLL_MS * 4));
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0]?.(sampleSnapshot);
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(LIVE_DISPATCH_POLL_MS));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it("backs off after errors and resets the delay after a successful snapshot", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    let request = 0;
    const fetchSnapshot = vi.fn(async () => {
      request += 1;
      if (request < 3) throw new Error("offline");
      return sampleSnapshot;
    });
    await mountHook(fetchSnapshot);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(latest?.attempts).toBe(1);

    await act(async () => vi.advanceTimersByTimeAsync(LIVE_DISPATCH_POLL_MS));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(latest?.attempts).toBe(2);

    await act(async () => vi.advanceTimersByTimeAsync(getLiveDispatchRetryDelay(2) - 1));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
    expect(latest?.snapshot).toEqual(sampleSnapshot);
    expect(latest?.attempts).toBe(0);

    await act(async () => vi.advanceTimersByTimeAsync(LIVE_DISPATCH_POLL_MS));
    expect(fetchSnapshot).toHaveBeenCalledTimes(4);
  });

  it("caps exponential delay at thirty seconds", () => {
    expect(getLiveDispatchRetryDelay(1)).toBe(3_000);
    expect(getLiveDispatchRetryDelay(2)).toBe(6_000);
    expect(getLiveDispatchRetryDelay(20)).toBe(LIVE_DISPATCH_MAX_BACKOFF_MS);
  });
});
