"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import { Button } from "@velo/ui/primitives";
import { createRouteStageLabels, DateTime, EmptyState, ErrorState, Money, PageHeader, Pagination, RouteStrip, Section, SegmentedControl, StatusBadge } from "@velo/ui/composed";
import { Skeleton } from "@velo/ui/feedback";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { requestDriverProxy, type DriverRide, type SpringPage } from "../_lib/driver-client";
import {
  getDriverRideFareValue,
  isDriverRideActive,
  normalizeDriverRidePage,
  selectCurrentDriverRide,
  toMapPoint,
} from "../_lib/driver-ride-state";

const PAGE_SIZE = 10;
type RideFilter = "active" | "past";

export default function DriverRidesPage() {
  const words = getTenantLabelWords(useTenantBrandingOrDefault());
  const stageLabels = createRouteStageLabels(words.trip, words.driver);
  const [items, setItems] = useState<DriverRide[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<RideFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRides = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await requestDriverProxy<SpringPage<DriverRide>>(
        `drivers/getMyRides?pageOffset=${requestedPage}&pageSize=${PAGE_SIZE}`,
      );
      setItems(normalizeDriverRidePage(response));
      setPage(Number.isFinite(response.number) ? Number(response.number) : requestedPage);
      setTotalPages(Math.max(Number.isFinite(response.totalPages) ? Number(response.totalPages) : 1, 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Unable to load ${words.tripsWord}.`);
    } finally {
      setLoading(false);
    }
  }, [words.tripsWord]);

  useEffect(() => {
    void loadRides(0);
  }, [loadRides]);

  const currentTrip = useMemo(() => selectCurrentDriverRide(items), [items]);
  const visibleTrips = useMemo(
    () => items.filter((ride) => isDriverRideActive(ride.rideStatus) === (filter === "active")),
    [filter, items],
  );

  const options = [
    { value: "active", label: "Active", count: items.filter((ride) => isDriverRideActive(ride.rideStatus)).length },
    { value: "past", label: "Past", count: items.filter((ride) => !isDriverRideActive(ride.rideStatus)).length },
  ];

  return (
    <main className="stack">
      <PageHeader title={`Your ${words.tripWord} history`} description={`Follow active ${words.tripsWord} and review completed ones.`} />

      {currentTrip ? (
        <Section title={`Continue your active ${words.tripWord}`}>
          <div className="driver-trip-summary">
            <div className="driver-row-meta">
              <code className="driver-reference">{words.trip} {currentTrip.id}</code>
              <StatusBadge domain="ride" status={currentTrip.rideStatus} labels={words} />
            </div>
            <RouteStrip stage={currentTrip.rideStatus} stageLabels={stageLabels} />
            <div className="driver-row-meta">
              <DateTime value={currentTrip.startedAt ?? currentTrip.createdTime} />
              <Money amount={getDriverRideFareValue(currentTrip)} emphasis />
              <Link href={`/ride/${currentTrip.id}`} className="ui-button" data-variant="primary">{`Continue ${words.tripWord}`}</Link>
            </div>
          </div>
        </Section>
      ) : null}

      <Section
        title={`${words.trip} history`}
        actions={<Button variant="secondary" disabled={loading} onClick={() => void loadRides(page)}>Refresh</Button>}
      >
        <SegmentedControl
          ariaLabel={`Filter ${words.tripsWord}`}
          value={filter}
          onValueChange={(value) => setFilter(value as RideFilter)}
          options={options}
        />

        {error ? <ErrorState title={`Couldn't load ${words.tripsWord}`} description={error} onRetry={() => void loadRides(page)} /> : null}
        {loading ? (
          <div className="driver-trip-list" role="status" aria-label={`Loading ${words.tripsWord}`} aria-busy="true">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 w-full" />)}
          </div>
        ) : null}
        {!loading && !error && visibleTrips.length === 0 ? (
          <EmptyState
            title={filter === "active" ? `No active ${words.tripsWord}` : `No past ${words.tripsWord} yet`}
            description={filter === "active" ? `Accepted ${words.tripsWord} will appear here while they're in progress.` : `Completed and cancelled ${words.tripsWord} will appear here.`}
            action={<Link href="/" className="ui-button" data-variant="secondary">Back to home</Link>}
          />
        ) : null}
        {!loading && !error && visibleTrips.length > 0 ? (
          <div className="driver-trip-list">
            {visibleTrips.map((ride) => {
              const pickup = toMapPoint(ride.pickupLocation);
              const dropOff = toMapPoint(ride.dropOffLocation);
              return (
                <article className="driver-trip-row" key={ride.id}>
                  <div className="driver-trip-summary">
                    <div className="driver-row-meta">
                      <code className="driver-reference">{words.trip} {ride.id}</code>
                      <StatusBadge domain="ride" status={ride.rideStatus} labels={words} />
                      <DateTime value={ride.startedAt ?? ride.createdTime ?? ride.endedAt} />
                    </div>
                    <RouteStrip
                      stage={ride.rideStatus}
                      variant="static"
                      showDriverMarker={false}
                      stageLabels={stageLabels}
                      pickupLabel={pickup ? "Pickup" : "Pickup unavailable"}
                      dropoffLabel={dropOff ? "Drop-off" : "Drop-off unavailable"}
                    />
                  </div>
                  <div className="driver-row-meta">
                    <Money amount={getDriverRideFareValue(ride)} />
                    <Link href={`/ride/${ride.id}`} className="ui-button" data-variant="secondary">{`View ${words.tripWord}`}</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        <Pagination
          page={page + 1}
          totalPages={totalPages}
          onPageChange={(nextPage) => void loadRides(nextPage - 1)}
        />
      </Section>
    </main>
  );
}
