"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorState, LiveStatusPill, ReconnectingIndicator } from "@velo/ui";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { getTenantLabelForCount, getTenantPluralLabel, getTenantPluralTripLabel } from "@velo/app-core/tenant";
import type { AdminLiveDispatchSnapshotDto } from "@velo/api/types";
import type { FleetMapFocusRequest, FleetMapSelection } from "@velo/ui/fleet-map";
import { useLiveDispatch } from "./use-live-dispatch";
import styles from "./live-fleet-panel.module.css";

const FleetMapView = dynamic(
  () => import("@velo/ui/fleet-map").then((module) => module.FleetMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapSkeleton} role="status" aria-label="Loading live fleet map" aria-busy="true" />,
  },
);

type LiveFleetPanelProps = {
  onOpenTripsChanged: () => void;
};

function openTripSignature(snapshot: AdminLiveDispatchSnapshotDto): string {
  return snapshot.rides
    .map((ride) => ride.rideId === null ? `request:${ride.rideRequestId}` : `ride:${ride.rideId}`)
    .sort()
    .join("|");
}

function lastUpdateLabel(value: string | null | undefined, stale: boolean): string {
  if (!value) return "Last seen time unavailable";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Last seen time unavailable";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  const age = seconds < 60 ? `${seconds} s ago` : `${Math.floor(seconds / 60)} min ago`;
  return `${stale ? "Last seen" : "Updated"} ${age}`;
}

function driverStatus(status: string, tripLabel: string): string {
  if (status === "EN_ROUTE_TO_PICKUP") return "To pickup";
  if (status === "ON_TRIP") return `On ${getTenantLabelForCount(1, tripLabel, { midSentence: true })}`;
  return "Available";
}

function rideStatus(status: string, tripLabel: string): string {
  if (status === "REQUESTED") {
    return tripLabel.trim().toLowerCase() === "trip" ? "Waiting" : `${tripLabel} requested`;
  }
  if (status === "CONFIRMED") return "To pickup";
  if (status === "ONGOING") return `On ${getTenantLabelForCount(1, tripLabel, { midSentence: true })}`;
  return "Waiting";
}

function Stat({ label, value }: { label: string; value: number }) {
  const testId = `fleet-count-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={styles.stat} data-testid={testId}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className={styles.stats} role="status" aria-label="Loading fleet counts" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => <span className={styles.statSkeleton} key={index} />)}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className={styles.listSkeleton} role="status" aria-label="Loading fleet list" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => <span className={styles.rowSkeleton} key={index} />)}
    </div>
  );
}

export function LiveFleetPanel({ onOpenTripsChanged }: LiveFleetPanelProps) {
  const { riderLabel, driverLabel, tripLabel } = useTenantBrandingOrDefault();
  const live = useLiveDispatch();
  const [selection, setSelection] = useState<FleetMapSelection | null>(null);
  const [focusRequest, setFocusRequest] = useState<FleetMapFocusRequest | null>(null);
  const previousTripSignature = useRef<string | null>(null);
  const snapshot = live.snapshot;

  useEffect(() => {
    if (!snapshot) return;
    const nextSignature = openTripSignature(snapshot);
    if (previousTripSignature.current !== null && previousTripSignature.current !== nextSignature) onOpenTripsChanged();
    previousTripSignature.current = nextSignature;
  }, [onOpenTripsChanged, snapshot]);

  const counts = useMemo(() => ({
    available: snapshot?.drivers.filter((driver) => driver.status === "AVAILABLE").length ?? 0,
    pickup: snapshot?.drivers.filter((driver) => driver.status === "EN_ROUTE_TO_PICKUP").length ?? 0,
    onTrip: snapshot?.drivers.filter((driver) => driver.status === "ON_TRIP").length ?? 0,
    waiting: snapshot?.rides.filter((ride) => ride.status === "REQUESTED").length ?? 0,
  }), [snapshot]);

  function focusFromList(next: FleetMapSelection): void {
    setSelection(next);
    setFocusRequest((previous) => ({ selection: next, sequence: (previous?.sequence ?? 0) + 1 }));
  }

  function selectFromMap(next: FleetMapSelection): void {
    setSelection(next);
  }

  const simulatedCount = snapshot?.drivers.filter((driver) => driver.simulated).length ?? 0;
  const heading = getTenantPluralLabel(driverLabel, "Driver");
  const riderWord = getTenantLabelForCount(1, riderLabel, { midSentence: true, fallback: "Rider" });
  const tripWord = getTenantLabelForCount(1, tripLabel, { midSentence: true, fallback: "Trip" });
  const waitingRiderLabel = riderLabel.trim().toLowerCase() === "rider" ? "Waiting request" : `Waiting ${riderWord}`;
  const tripPlural = getTenantPluralTripLabel(tripLabel);
  const hasError = Boolean(live.error);

  return (
    <section className={styles.panel} aria-labelledby="live-fleet-heading">
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <div className={styles.eyebrow}>Operations overview</div>
          <h2 id="live-fleet-heading">Live fleet <span aria-hidden="true">·</span> {heading}</h2>
        </div>
        <LiveStatusPill state={hasError ? "reconnecting" : snapshot ? "connected" : "connecting"} label={hasError ? "Reconnecting" : snapshot ? "Live" : "Connecting"} />
      </header>

      {hasError && snapshot ? (
        <ReconnectingIndicator
          className={styles.reconnecting}
          state="error"
          message="Live updates paused, retrying"
          attempts={live.attempts}
          onRetry={live.retry}
          retrying={live.retrying}
          retryLabel="Retry now"
        />
      ) : null}

      <div className={styles.layout}>
        <div className={styles.mapColumn}>
          <div className={styles.mapSlot}>
            <FleetMapView
              drivers={snapshot?.drivers ?? []}
              rides={snapshot?.rides ?? []}
              focusRequest={focusRequest}
              onSelectionChange={selectFromMap}
            />
            {!snapshot && live.isLoading ? <div className={styles.mapSkeleton} role="status" aria-label="Loading live fleet map" aria-busy="true" /> : null}
            {!snapshot && live.error ? (
              <div className={styles.mapError}>
                <ErrorState title="Live fleet unavailable" description={live.error.message} onRetry={live.retry} />
              </div>
            ) : null}
          </div>
        </div>

        <aside className={styles.sidePanel} aria-label="Fleet status and open trips">
          {snapshot ? (
            <div className={styles.stats} role="group" aria-label="Live fleet counts">
              <Stat label="Available" value={counts.available} />
              <Stat label="To pickup" value={counts.pickup} />
              <Stat label={`On ${tripWord}`} value={counts.onTrip} />
              <Stat label="Waiting requests" value={counts.waiting} />
            </div>
          ) : live.error ? <div className={styles.sideError}>Fleet counts will return when the connection is restored.</div> : <StatsSkeleton />}

          <div className={styles.listHeading}>
            <h3>{heading} &amp; open {tripPlural.toLowerCase()}</h3>
            {snapshot ? <span>{snapshot.drivers.length + snapshot.rides.length}</span> : null}
          </div>

          {snapshot ? (
            <div className={styles.scrollList} role="group" aria-label={`${heading} and open ${tripPlural.toLowerCase()}`}>
              {snapshot.drivers.length ? (
                <>
                  <h4 className={styles.groupHeading}>{heading}</h4>
                  {snapshot.drivers.map((driver) => {
                    const key = `driver:${driver.driverId}`;
                    const active = selection?.type === "driver" && selection.id === driver.driverId;
                    return (
                      <button className={styles.listRow} data-selected={active} key={key} type="button" onClick={() => focusFromList({ type: "driver", id: driver.driverId })}>
                        <span className={`${styles.rowIndicator} ${styles[`tone_${driver.status}`]}`} aria-hidden="true" />
                        <span className={styles.rowCopy}>
                          <span className={styles.rowTitle}>{driver.name}<span className={styles.plate}>{driver.vehiclePlate}</span></span>
                          <span className={styles.rowMeta}>{driverStatus(driver.status, tripLabel)} · {lastUpdateLabel(driver.locationUpdatedAt, driver.stale)}</span>
                        </span>
                      </button>
                    );
                  })}
                </>
              ) : null}
              {snapshot.rides.length ? (
                <>
                  <h4 className={styles.groupHeading}>{tripPlural}</h4>
            {snapshot.rides.map((ride) => {
                    const active = selection?.type === "ride" && selection.id === ride.rideRequestId;
                    return (
                      <button className={styles.listRow} data-selected={active} key={`ride:${ride.rideRequestId}`} type="button" onClick={() => focusFromList({ type: "ride", id: ride.rideRequestId })}>
                        <span className={`${styles.rowIndicator} ${styles.rideIndicator}`} aria-hidden="true" />
                        <span className={styles.rowCopy}>
                          <span className={styles.rowTitle}>{ride.riderName || waitingRiderLabel}<span className={styles.tripNumber}>{ride.rideId ? `${tripLabel} ${ride.rideId}` : `New ${tripWord}`}</span></span>
                          <span className={styles.rowMeta}>{rideStatus(ride.status, tripLabel)} · {ride.pickup.address || "Address not set"}</span>
                        </span>
                      </button>
                    );
                  })}
                </>
              ) : null}
              {!snapshot.drivers.length && !snapshot.rides.length ? (
                <p className={styles.listEmpty}>No active {heading.toLowerCase()} or open {tripPlural.toLowerCase()}.</p>
              ) : null}
            </div>
          ) : live.error ? <p className={styles.listEmpty}>Fleet details will return when the connection is restored.</p> : <ListSkeleton />}

          {snapshot ? <p className={styles.footer}>{simulatedCount > 0 ? `Includes ${simulatedCount} simulated ${getTenantPluralLabel(driverLabel, "Driver").toLowerCase()}` : ""}</p> : null}
        </aside>
      </div>
    </section>
  );
}
