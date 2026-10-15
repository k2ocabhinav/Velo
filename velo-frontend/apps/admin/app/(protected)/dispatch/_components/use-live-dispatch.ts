"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminLiveDispatchSnapshotDto } from "@velo/api/types";
import { adminClient } from "./live-dispatch-client";

export const LIVE_DISPATCH_POLL_MS = 3_000;
export const LIVE_DISPATCH_MAX_BACKOFF_MS = 30_000;

export type LiveDispatchFetcher = (signal: AbortSignal) => Promise<AdminLiveDispatchSnapshotDto>;
const defaultFetcher: LiveDispatchFetcher = (signal) => adminClient.getLiveDispatch(signal);

export interface LiveDispatchState {
  snapshot: AdminLiveDispatchSnapshotDto | null;
  error: Error | null;
  isLoading: boolean;
  retrying: boolean;
  attempts: number;
  retry: () => void;
}

export function getLiveDispatchRetryDelay(failures: number): number {
  return Math.min(LIVE_DISPATCH_POLL_MS * (2 ** Math.max(0, failures - 1)), LIVE_DISPATCH_MAX_BACKOFF_MS);
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Live fleet updates are unavailable.");
}

export function useLiveDispatch(fetchSnapshot: LiveDispatchFetcher = defaultFetcher): LiveDispatchState {
  const [snapshot, setSnapshot] = useState<AdminLiveDispatchSnapshotDto | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setAttempts(0);
    setRetrying(true);
    setError(null);
    setRetryToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    let failures = 0;
    let requestSequence = 0;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const schedule = (delay: number) => {
      clearTimer();
      if (!mounted || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        timer = null;
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (!mounted || inFlight || document.visibilityState !== "visible") return;
      clearTimer();
      inFlight = true;
      const sequence = ++requestSequence;
      const requestController = new AbortController();
      controller = requestController;
      try {
        const nextSnapshot = await fetchSnapshot(requestController.signal);
        if (!mounted || sequence !== requestSequence || requestController.signal.aborted) return;
        failures = 0;
        setSnapshot(nextSnapshot);
        setError(null);
        setIsLoading(false);
        setRetrying(false);
        setAttempts(0);
      } catch (fetchError) {
        if (!mounted || sequence !== requestSequence || requestController.signal.aborted) return;
        failures += 1;
        setError(toError(fetchError));
        setIsLoading(false);
        setRetrying(false);
        setAttempts(failures);
      } finally {
        if (sequence === requestSequence) {
          inFlight = false;
          controller = null;
          if (mounted && document.visibilityState === "visible") {
            schedule(failures === 0 ? LIVE_DISPATCH_POLL_MS : getLiveDispatchRetryDelay(failures));
          }
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer();
        requestSequence += 1;
        controller?.abort();
        controller = null;
        inFlight = false;
        return;
      }
      void poll();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState === "visible") void poll();

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimer();
      requestSequence += 1;
      controller?.abort();
    };
  }, [fetchSnapshot, retryToken]);

  return { snapshot, error, isLoading, retrying, attempts, retry };
}
