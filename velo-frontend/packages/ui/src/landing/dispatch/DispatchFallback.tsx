"use client";

import { useEffect, useRef } from "react";
import { generateDispatchCoordinates, type BuildingCoordinate, type Point2 } from "./scene/coordinates";
import type { PreviewPhase } from "./scene/DispatchCanvas";
import type { SampleTrip } from "./sample-trips";
import styles from "./dispatch.module.css";

const coordinates = generateDispatchCoordinates();

type ProjectionPoint = { x: number; y: number };

function project(point: Point2, height = 0): ProjectionPoint {
  return {
    x: 320 + (point.x - point.z) * 15,
    y: 190 + (point.x + point.z) * 7 - height * 14,
  };
}

function pointString(point: ProjectionPoint): string {
  return `${Math.round(point.x)},${Math.round(point.y)}`;
}

function projectLine(points: readonly Point2[], origin?: ProjectionPoint): string {
  const projected = points.map((point) => project(point));
  if (!origin) return projected.map(pointString).join(" ");
  return projected.map((point) => pointString({ x: point.x - origin.x, y: point.y - origin.y })).join(" ");
}

function buildingFaces(building: BuildingCoordinate) {
  const { x, z, width, depth, height } = building;
  const groundCorners = [
    { x: x + width / 2, z: z + depth / 2 },
    { x: x + width / 2, z: z - depth / 2 },
    { x: x - width / 2, z: z - depth / 2 },
    { x: x - width / 2, z: z + depth / 2 },
  ];
  const topCorners = groundCorners.map((point) => project(point, height));
  const baseCorners = groundCorners.map((point) => project(point));
  const top = topCorners.map(pointString).join(" ");
  const faces = ([[0, 1], [0, 3]] as const).map(([a, b]) =>
    [topCorners[a], topCorners[b], baseCorners[b], baseCorners[a]]
      .filter((point): point is ProjectionPoint => point !== undefined)
      .map(pointString)
      .join(" "),
  );
  return { top, faces };
}

function routeMotionPath(points: readonly Point2[]): { start: ProjectionPoint; path: string } {
  const start = project(points[0] ?? { x: 0, z: 0 });
  return { start, path: projectLine(points, start) };
}

/** Cartographic graticule: small crosses at the street-grid intersections. */
function graticulePath(): string {
  const marks: string[] = [];
  for (const x of [-8, -4, 0, 4, 8]) {
    for (const z of [-6, -3, 0, 3, 6]) {
      const point = project({ x, z });
      marks.push(`M${Math.round(point.x) - 2} ${Math.round(point.y)}h4m-2-2v4`);
    }
  }
  return marks.join("");
}

export type DispatchFallbackProps = {
  selectedTripId?: SampleTrip["id"];
  previewRunId?: number;
  previewPhase?: PreviewPhase;
  reducedMotion?: boolean;
  className?: string | undefined;
};

export function DispatchFallback({
  selectedTripId = "09:15",
  previewRunId = 0,
  previewPhase = "idle",
  reducedMotion = false,
  className,
}: DispatchFallbackProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const motionRef = useRef<SVGAnimateMotionElement>(null);
  const lastRunId = useRef(0);
  const lastPhase = useRef<PreviewPhase>("idle");
  const selectedRoute = coordinates.routes[selectedTripId];
  const selectedMotion = routeMotionPath(selectedRoute);
  const buildingOrder = [...coordinates.buildings, ...coordinates.landmarks].sort((a, b) => a.x + a.z - (b.x + b.z));
  const graticule = graticulePath();

  useEffect(() => {
    const svg = svgRef.current;
    const animation = motionRef.current;
    if (!svg || !animation) return;

    if (previewRunId !== lastRunId.current) {
      lastRunId.current = previewRunId;
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }

    if (reducedMotion) {
      svg.pauseAnimations();
      if (previewPhase === "travel") lastPhase.current = "paused";
      return;
    }

    if (previewPhase === "travel" && lastPhase.current === "paused") {
      svg.unpauseAnimations();
    } else if (previewPhase === "travel" && lastPhase.current !== "travel") {
      svg.unpauseAnimations();
      animation.beginElement();
    } else if (previewPhase !== "travel") {
      svg.pauseAnimations();
    }

    lastPhase.current = previewPhase;
  }, [previewRunId, previewPhase, reducedMotion, selectedTripId]);

  return (
    <svg
      ref={svgRef}
      className={[styles.fallback, className].filter(Boolean).join(" ")}
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-dispatch-fallback="true"
    >
      <rect width="640" height="360" fill="var(--dispatch-ground)" />
      <g className={styles.mobileMapScale}>
        <path d={graticule} fill="none" stroke="var(--dispatch-street)" strokeWidth="0.6" opacity="0.55" />
        <g fill="none" stroke="var(--dispatch-street)" strokeWidth="10" strokeLinecap="round" opacity="0.9">
          {coordinates.streets.map((street, index) => (
            <polyline key={`street-${index}`} points={projectLine(street)} />
          ))}
        </g>
        <g fill="none" stroke="var(--dispatch-lane)" strokeWidth="1.2" strokeDasharray="3 5" opacity="0.8">
          {coordinates.streets.map((street, index) => (
            <polyline key={`lane-${index}`} points={projectLine(street)} />
          ))}
        </g>
        <g>
          {buildingOrder.map((building, index) => {
            const faces = buildingFaces(building);
            const landmark = building.kind !== "building";
            return (
              <g key={`${building.kind}-${index}`}>
                {faces.faces.map((face, faceIndex) => (
                  <polygon
                    key={faceIndex}
                    points={face}
                    fill={landmark ? "var(--dispatch-roof)" : "var(--dispatch-building)"}
                    stroke="var(--dispatch-edge)"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                ))}
                <polygon
                  points={faces.top}
                  fill="var(--dispatch-roof)"
                  opacity={landmark ? 1 : 0.85}
                  stroke="var(--dispatch-edge)"
                  strokeWidth="0.5"
                  strokeLinejoin="round"
                />
                {building.label && (() => {
                  const labelPoint = project(building, building.height + 0.26);
                  return (
                    <text
                      key="label"
                      x={labelPoint.x}
                      y={labelPoint.y - 4}
                      textAnchor="middle"
                      className={styles.mapLabel}
                    >
                      {building.label}
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </g>
        {/* Thin cartographic halo under every route. */}
        <g className={styles.routeHalo} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {Object.entries(coordinates.routes).map(([tripId, route]) => {
            const active = tripId === selectedTripId;
            return (
              <polyline
                key={`halo-${tripId}`}
                points={projectLine(route)}
                stroke={active ? "var(--dispatch-route)" : "var(--dispatch-route-alt)"}
                strokeWidth={active ? 15 : 10.5}
              />
            );
          })}
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {Object.entries(coordinates.routes).map(([tripId, route]) => {
            const active = tripId === selectedTripId;
            return (
              <polyline
                key={tripId}
                points={projectLine(route)}
                stroke={active ? "var(--dispatch-route)" : "var(--dispatch-route-alt)"}
                strokeWidth={active ? 4.2 : 2.55}
                opacity={active ? previewPhase === "assign" ? 0.36 : 0.95 : 0.55}
              />
            );
          })}
        </g>
        <g>
          {coordinates.vehicles.map((vehicle, index) => {
            const point = project(vehicle);
            const selected = vehicle.tripId === selectedTripId && vehicle.routeProgress < 0.5;
            if (selected) {
              return (
                <g key={`vehicle-${index}`} transform={`translate(${selectedMotion.start.x} ${selectedMotion.start.y})`}>
                  <circle r="5.4" fill="var(--dispatch-route-alt)" stroke="var(--dispatch-ground)" strokeWidth="2">
                    <animateMotion
                      ref={motionRef}
                      path={selectedMotion.path}
                      begin="indefinite"
                      dur="2.36s"
                      fill="freeze"
                    />
                  </circle>
                </g>
              );
            }
            return (
              <circle
                key={`vehicle-${index}`}
                cx={point.x}
                cy={point.y - 1.5}
                r={vehicle.tripId === selectedTripId ? 4.4 : 3.2}
                fill={vehicle.tripId === selectedTripId ? "var(--dispatch-route-alt)" : "var(--dispatch-vehicle)"}
                stroke="var(--dispatch-ground)"
                strokeWidth="1.5"
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
