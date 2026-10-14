import type { CSSProperties } from "react";
import { cn } from "../lib/cn";

export const ROUTE_STAGES = ["requested", "assigned", "arriving", "on_trip", "completed"] as const;
export type RouteStage = (typeof ROUTE_STAGES)[number] | "cancelled";
export type RouteStripVariant = "live" | "static";

const STAGE_COPY: Record<Exclude<RouteStage, "cancelled">, string> = {
  requested: "Trip requested",
  assigned: "Driver assigned",
  arriving: "Driver arriving",
  on_trip: "Trip in progress",
  completed: "Trip completed",
};

const STATUS_ALIASES: Record<string, RouteStage> = {
  PENDING: "requested",
  REQUESTED: "requested",
  ASSIGNED: "assigned",
  CONFIRMED: "assigned",
  ACCEPTED: "assigned",
  ARRIVING: "arriving",
  ONGOING: "on_trip",
  ON_TRIP: "on_trip",
  COMPLETED: "completed",
  ENDED: "completed",
  CANCELLED: "cancelled",
  CANCELED: "cancelled",
};

/**
 * Show the pickup-to-drop-off progress line with text that communicates its current stage.
 * The static variant is intended for history rows and never displays a live marker.
 */
export function RouteStrip({
  className,
  driverProgress,
  dropoffLabel = "Drop-off",
  pickupLabel = "Pickup",
  showDriverMarker = true,
  stage,
  variant = "live",
}: {
  stage: RouteStage | string;
  variant?: RouteStripVariant;
  pickupLabel?: string;
  dropoffLabel?: string;
  driverProgress?: number;
  showDriverMarker?: boolean;
  className?: string;
}) {
  const normalizedStage = normalizeStage(stage);
  const cancelled = normalizedStage === "cancelled";
  const stageIndex = cancelled ? 0 : ROUTE_STAGES.indexOf(normalizedStage);
  const progress = stageIndex / (ROUTE_STAGES.length - 1);
  const clampedDriverProgress = driverProgress === undefined
    ? progress
    : Math.min(1, Math.max(0, driverProgress));
  const statusCopy = cancelled ? "Trip cancelled" : STAGE_COPY[normalizedStage];
  const accessibleCopy = `${statusCopy}, step ${stageIndex + 1} of ${ROUTE_STAGES.length}`;

  return (
    <div
      className={cn("route-strip", className)}
      data-variant={variant}
      data-stage={normalizedStage}
      role="img"
      aria-label={accessibleCopy}
      style={{
        "--route-progress": `${progress * 100}%`,
        "--route-marker": `${clampedDriverProgress * 100}%`,
      } as CSSProperties}
    >
      <p className="route-strip-status" aria-hidden="true">{statusCopy}</p>
      <div className="route-strip-track" aria-hidden="true">
        <span className="route-strip-rail" />
        <span className="route-strip-progress" />
        <span className="route-strip-stops">
          <span className="route-strip-stop" data-complete="true" />
          <span className="route-strip-stop" data-complete={progress >= 1 || undefined} />
        </span>
        {showDriverMarker && variant === "live" && !cancelled && stageIndex > 0 && stageIndex < ROUTE_STAGES.length - 1 ? (
          <span className="route-strip-marker" />
        ) : null}
      </div>
      <div className="route-strip-labels" aria-hidden="true">
        <span>{pickupLabel}</span>
        <span>{dropoffLabel}</span>
      </div>
    </div>
  );
}

function normalizeStage(stage: string): RouteStage {
  const normalized = stage.trim().toUpperCase().replace(/[ -]+/g, "_");
  return STATUS_ALIASES[normalized] ?? (ROUTE_STAGES.includes(stage.toLowerCase() as (typeof ROUTE_STAGES)[number])
    ? stage.toLowerCase() as RouteStage
    : "requested");
}
