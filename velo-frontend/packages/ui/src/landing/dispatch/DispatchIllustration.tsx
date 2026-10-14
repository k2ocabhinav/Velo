"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { browserSupportsDispatchCanvas } from "./eligibility";
import { DispatchFallback } from "./DispatchFallback";
import { SAMPLE_TRIPS, TRIP_STATUS_STEPS, getSampleTrip, type SampleTrip, type TripStatusStep } from "./sample-trips";
import styles from "./dispatch.module.css";
import type { DispatchCanvasProps, PreviewPhase } from "./scene/DispatchCanvas";

type CanvasComponent = ComponentType<DispatchCanvasProps>;
type PreviewState = {
  phase: PreviewPhase;
  runId: number;
  pausedPhase?: Exclude<PreviewPhase, "idle" | "paused" | "complete">;
};

const PREVIEW_DURATIONS = { assign: 620, route: 620, travel: 2_360 } as const;

function forcedSvgFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get("dispatch") === "svg";
}

export type DispatchIllustrationProps = {
  className?: string;
  forceSvg?: boolean;
};

export function DispatchIllustration({ className, forceSvg = false }: DispatchIllustrationProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [canvasModule, setCanvasModule] = useState<CanvasComponent | null>(null);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [selectedTripId, setSelectedTripId] = useState<SampleTrip["id"]>("09:15");
  const [preview, setPreview] = useState<PreviewState>({ phase: "idle", runId: 0 });
  const previewClock = useRef<{ remaining: Record<keyof typeof PREVIEW_DURATIONS, number> }>({ remaining: { ...PREVIEW_DURATIONS } });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
      rootMargin: "80px",
      threshold: 0.01,
    });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const width = window.matchMedia("(min-width: 1024px)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const updateEligibility = () => {
      const forced = forceSvg || forcedSvgFromUrl();
      setReducedMotion(reducedMotion.matches);
      const nextEligible = !forced && browserSupportsDispatchCanvas();
      setEligible(nextEligible);
      if (reducedMotion.matches) {
        setPreview((current) => current.phase === "travel" ? { ...current, phase: "paused", pausedPhase: "travel" } : current);
      }
      if (nextEligible) setCanvasFailed(false);
      else setWebglReady(false);
    };

    updateEligibility();
    width.addEventListener("change", updateEligibility);
    finePointer.addEventListener("change", updateEligibility);
    reducedMotion.addEventListener("change", updateEligibility);
    connection?.addEventListener("change", updateEligibility);
    return () => {
      width.removeEventListener("change", updateEligibility);
      finePointer.removeEventListener("change", updateEligibility);
      reducedMotion.removeEventListener("change", updateEligibility);
      connection?.removeEventListener("change", updateEligibility);
    };
  }, [forceSvg]);

  useEffect(() => {
    if (!eligible || !inView || canvasModule || canvasFailed) return;
    let cancelled = false;
    let timeout: number | undefined;
    let idleHandle: number | undefined;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const load = () => {
      void import("./scene/DispatchCanvas")
        .then((module) => {
          if (!cancelled) setCanvasModule(() => module.DispatchCanvas);
        })
        .catch(() => {
          if (!cancelled) setCanvasFailed(true);
        });
    };

    if (idleWindow.requestIdleCallback) idleHandle = idleWindow.requestIdleCallback(load, { timeout: 1_400 });
    else timeout = window.setTimeout(load, 0);
    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [eligible, inView, canvasModule, canvasFailed]);

  useEffect(() => {
    if (!inView || !["assign", "route", "travel"].includes(preview.phase)) return;
    const phase = preview.phase as Exclude<PreviewPhase, "idle" | "paused" | "complete">;
    const duration = previewClock.current.remaining[phase];
    const startedAt = performance.now();
    let completed = false;
    const timeout = window.setTimeout(() => {
      completed = true;
      previewClock.current.remaining[phase] = PREVIEW_DURATIONS[phase];
      setPreview((current) => {
        if (current.runId !== preview.runId || current.phase !== phase) return current;
        if (phase === "assign") return { ...current, phase: "route" };
        if (phase === "route") return { ...current, phase: "travel" };
        return { ...current, phase: "complete" };
      });
    }, duration);

    return () => {
      window.clearTimeout(timeout);
      if (!completed) {
        previewClock.current.remaining[phase] = Math.max(0, duration - (performance.now() - startedAt));
      }
    };
  }, [eligible, inView, preview.phase, preview.runId]);

  const selectedTrip = getSampleTrip(selectedTripId);
  const canvasActive = eligible && Boolean(canvasModule) && !canvasFailed;
  const activePreviewPhase = preview.phase === "paused" ? preview.pausedPhase : preview.phase;
  const previewStatus = activePreviewPhase === "assign"
    ? "Assigning a driver"
    : activePreviewPhase === "route"
      ? "Lighting the route"
      : activePreviewPhase === "travel"
        ? "On trip"
        : selectedTrip.status;
  const activeStatus: TripStatusStep = activePreviewPhase === "assign" || activePreviewPhase === "route"
    ? "Driver assigned"
    : activePreviewPhase === "travel"
      ? "On trip"
      : selectedTrip.status;
  const activeStatusIndex = TRIP_STATUS_STEPS.indexOf(activeStatus);
  const statusMessage = previewStatus;
  const previewLabel = preview.phase === "assign" || preview.phase === "route" || preview.phase === "travel"
    ? "Pause preview"
    : preview.phase === "paused"
      ? "Resume preview"
      : preview.phase === "complete"
        ? "Replay preview"
        : "Preview dispatch";
  const Canvas = canvasModule;

  function selectTrip(id: SampleTrip["id"]) {
    previewClock.current.remaining = { ...PREVIEW_DURATIONS };
    setSelectedTripId(id);
    setPreview((current) => ({ phase: "idle", runId: current.runId }));
  }

  function togglePreview() {
    setPreview((current) => {
      if (["assign", "route", "travel"].includes(current.phase)) {
        const pausedPhase = current.phase as NonNullable<PreviewState["pausedPhase"]>;
        return { phase: "paused", runId: current.runId, pausedPhase };
      }
      if (current.phase === "paused") {
        return { phase: current.pausedPhase ?? "assign", runId: current.runId };
      }
      previewClock.current.remaining = { ...PREVIEW_DURATIONS };
      return { phase: "assign", runId: current.runId + 1 };
    });
  }

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Interactive sample dispatch"
      data-renderer={webglReady ? "webgl" : "svg"}
      data-webgl-ready={webglReady ? "true" : "false"}
    >
      <div className={styles.scene} ref={sceneRef} data-dispatch-scene>
        <DispatchFallback
          className={webglReady ? styles.fallbackHidden : undefined}
          selectedTripId={selectedTripId}
          previewRunId={preview.runId}
          previewPhase={!inView && preview.phase === "travel" ? "paused" : preview.phase}
          reducedMotion={reducedMotion}
        />
        {canvasActive && Canvas && (
          <Canvas
            selectedTripId={selectedTripId}
            previewPhase={preview.phase}
            previewRunId={preview.runId}
            resetVersion={resetVersion}
            onReady={() => setWebglReady(true)}
            onFallback={() => {
              setWebglReady(false);
              setCanvasFailed(true);
            }}
          />
        )}
        <article className={styles.tripCard} aria-label={`${selectedTrip.time} sample transfer`}>
          <div className={styles.cardTopline}>
            <p className={styles.tripTime}>{selectedTrip.time}</p>
            <span className={styles.stubNumber}>Nº {selectedTrip.time.replace(":", "")}</span>
          </div>
          <p className={styles.tripRoute}>{selectedTrip.pickup} to {selectedTrip.dropOff}</p>
          <div className={styles.driverLine}>
            <span>{selectedTrip.driver}</span>
            <span>{statusMessage}</span>
          </div>
          <ol className={styles.statusSteps} aria-label="Trip status steps">
            {selectedTrip.statusSteps.map((step, index) => (
              <li className={`${styles.statusStep} ${index === activeStatusIndex ? styles.statusStepActive : ""}`} key={step}>
                <span className={styles.statusMarker} aria-hidden="true" />
                {step}
              </li>
            ))}
          </ol>
        </article>
      </div>

      <div className={styles.controls}>
        <div className={styles.tripButtons} role="group" aria-label="Choose a sample trip">
          {SAMPLE_TRIPS.map((trip) => (
            <button
              className={styles.tripButton}
              type="button"
              key={trip.id}
              aria-pressed={trip.id === selectedTripId}
              onClick={() => selectTrip(trip.id)}
            >
              {trip.time}
            </button>
          ))}
        </div>
        <div className={styles.actionRow}>
          <button className={styles.actionButton} type="button" onClick={togglePreview}>
            {previewLabel}
          </button>
          <button
            className={styles.actionButton}
            type="button"
            disabled={!webglReady}
            onClick={() => setResetVersion((version) => version + 1)}
          >
            Reset view
          </button>
        </div>
        {/* Always rendered so enabling the canvas never shifts the page (CLS stays 0). */}
        <p className={`${styles.dragHint}${webglReady ? ` ${styles.dragHintOn}` : ""}`}>Drag the scene to tilt it.</p>
        <p className={styles.liveStatus} aria-live="polite" role="status">{statusMessage}</p>
      </div>
    </div>
  );
}
