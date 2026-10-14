"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import {
  Button,
  DateTime,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Pagination,
  RouteStrip,
  Section,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  ConfirmDialog,
} from "@velo/ui";
import { requestRiderProxy, type DecimalValue, type SpringPage } from "../_lib/rider-client";
import { mapApiError, validateRatingInput } from "../_lib/ride-forms";
import { useActiveRideRedirect } from "../_lib/use-active-ride-redirect";

type RideItem = {
  id: number;
  rideStatus: string;
  paymentMethod: string;
  createdTime?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  fare?: DecimalValue | null;
  fair?: DecimalValue | null;
};

const PAGE_SIZE = 10;
const DEFAULT_RATING = "5";
const COMPLETED_STATUSES = new Set(["ENDED", "COMPLETED"]);
const PAST_STATUSES = new Set([...COMPLETED_STATUSES, "CANCELLED", "CANCELED"]);

function toPageInfo(payload: SpringPage<RideItem>, fallbackPage: number) {
  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    number: typeof payload.number === "number" ? payload.number : fallbackPage,
    totalPages: Math.max(typeof payload.totalPages === "number" ? payload.totalPages : 1, 1),
  };
}

function canCancel(status: string): boolean {
  return !PAST_STATUSES.has(status.toUpperCase());
}

function isCompleted(status: string): boolean {
  return COMPLETED_STATUSES.has(status.toUpperCase());
}

export default function RiderRidesPage() {
  useActiveRideRedirect("/rides");

  const [rides, setRides] = useState<RideItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingRideId, setPendingRideId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"CANCEL" | "RATE" | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [ratingByRideId, setRatingByRideId] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [cancelRideId, setCancelRideId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<{ type: "cancel" | "rate"; rideId: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRides = useCallback(async (targetPage: number): Promise<void> => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await requestRiderProxy<SpringPage<RideItem>>(
        `riders/getMyRides?pageOffset=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      const parsed = toPageInfo(response, targetPage);
      setRides(parsed.content);
      setPage(parsed.number);
      setTotalPages(parsed.totalPages);
    } catch (loadError) {
      setLoadError(loadError instanceof Error ? mapApiError({ error: loadError.message }, "Couldn't load your trips.") : "Couldn't load your trips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides(0);
  }, [loadRides]);

  const visibleRides = useMemo(
    () => rides.filter((ride) => filter === "past" ? PAST_STATUSES.has(ride.rideStatus.toUpperCase()) : !PAST_STATUSES.has(ride.rideStatus.toUpperCase())),
    [filter, rides],
  );

  async function cancelRide(rideId: number): Promise<void> {
    const actionKey = `ride:${rideId}:cancel`;
    if (isActionPending(pendingActions, actionKey)) return;

    setPendingActions((current) => setActionPending(current, actionKey, true));
    setPendingRideId(rideId);
    setPendingAction("CANCEL");
    setActionError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      await requestRiderProxy<RideItem>(`riders/cancelRide/${rideId}`, { method: "POST" });
      setMessage("Trip cancelled.");
      await loadRides(page);
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? mapApiError({ error: cancelError.message }, "Couldn't cancel this trip.") : "Couldn't cancel this trip.");
      setRetryAction({ type: "cancel", rideId });
    } finally {
      setPendingRideId(null);
      setPendingAction(null);
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  async function rateDriver(rideId: number): Promise<void> {
    const actionKey = `ride:${rideId}:rate`;
    if (isActionPending(pendingActions, actionKey)) return;

    const ratingValue = ratingByRideId[rideId] ?? DEFAULT_RATING;
    const validation = validateRatingInput(ratingValue);
    if (!validation.ok) {
      setActionError(validation.error);
      setRetryAction({ type: "rate", rideId });
      setMessage(null);
      return;
    }

    setPendingActions((current) => setActionPending(current, actionKey, true));
    setPendingRideId(rideId);
    setPendingAction("RATE");
    setActionError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      await requestRiderProxy<unknown>("riders/rateDriver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId, rating: validation.rating }),
      });
      setMessage("Thanks for your rating.");
      await loadRides(page);
    } catch (rateError) {
      setActionError(rateError instanceof Error ? mapApiError({ error: rateError.message }, "Couldn't submit your rating.") : "Couldn't submit your rating.");
      setRetryAction({ type: "rate", rideId });
    } finally {
      setPendingRideId(null);
      setPendingAction(null);
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  return (
    <main className="app-shell rider-page stack">
      <PageHeader
        title="Your trips"
        description="See upcoming rides and revisit past trips."
        actions={<Link className="ui-button" data-variant="secondary" href="/scheduled">Scheduled trips</Link>}
      />

      <Section>
        <SegmentedControl
          ariaLabel="Trip history filter"
          value={filter}
          onValueChange={(value) => setFilter(value as "upcoming" | "past")}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
          ]}
        />

        {message ? <p className="booking-feedback" role="status">{message}</p> : null}
        {loadError ? <ErrorState title={loadError} onRetry={() => void loadRides(page)} /> : null}
        {!loadError && actionError ? (
          <ErrorState
            title={actionError}
            retryLabel="Retry"
            onRetry={() => {
              if (retryAction?.type === "cancel") setCancelRideId(retryAction.rideId);
              if (retryAction?.type === "rate") void rateDriver(retryAction.rideId);
            }}
          />
        ) : null}

        {loading ? (
          <div className="stack trip-list-skeleton" aria-label="Loading trips">
            {[0, 1, 2].map((row) => <div className="trip-skeleton-row" key={row}><Skeleton className="skeleton-line skeleton-line-wide" /><Skeleton className="skeleton-line" /></div>)}
          </div>
        ) : null}

        {!loading && !loadError && !actionError && visibleRides.length === 0 ? (
          <EmptyState
            title={filter === "past" ? "No past trips yet" : "No upcoming trips"}
            description={filter === "past" ? "Your completed and cancelled trips will appear here." : "Plan a ride to see it here."}
            action={<Link className="ui-button" data-variant="primary" href="/">Book a trip</Link>}
          />
        ) : null}

        {!loading && !loadError && !actionError && visibleRides.length > 0 ? (
          <div className="trip-list">
            {visibleRides.map((ride) => (
              <article key={ride.id} className="trip-row" data-testid="trip-row">
                <div className="trip-row-main">
                  <RouteStrip stage={ride.rideStatus} variant="static" />
                  <div className="trip-row-meta">
                    <DateTime value={ride.endedAt ?? ride.startedAt ?? ride.createdTime} />
                    <StatusBadge status={ride.rideStatus} domain="ride" />
                  </div>
                </div>
                <div className="trip-row-actions">
                  <Money amount={ride.fare ?? ride.fair ?? null} />
                  {isCompleted(ride.rideStatus) ? (
                    <div className="trip-rating" aria-label="Rate this trip">
                      <div className="rating-stars" role="group" aria-label="Choose a star rating">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const selected = Number(ratingByRideId[ride.id] ?? DEFAULT_RATING) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              className="rating-star"
                              aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                              aria-pressed={Number(ratingByRideId[ride.id] ?? DEFAULT_RATING) === star}
                              onClick={() => setRatingByRideId((current) => ({ ...current, [ride.id]: String(star) }))}
                            >{selected ? "★" : "☆"}</button>
                          );
                        })}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isActionPending(pendingActions, `ride:${ride.id}:rate`)}
                        onClick={() => void rateDriver(ride.id)}
                      >
                        {pendingRideId === ride.id && pendingAction === "RATE" ? "Saving rating…" : "Rate driver"}
                      </Button>
                    </div>
                  ) : null}
                  {canCancel(ride.rideStatus) ? (
                    <Button variant="ghost" size="sm" disabled={isActionPending(pendingActions, `ride:${ride.id}:cancel`)} onClick={() => setCancelRideId(ride.id)}>
                      {pendingRideId === ride.id && pendingAction === "CANCEL" ? "Cancelling…" : "Cancel trip"}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !loadError && !actionError ? <Pagination page={page + 1} totalPages={totalPages} onPageChange={(nextPage) => void loadRides(nextPage - 1)} /> : null}
      </Section>

      <ConfirmDialog
        open={cancelRideId !== null}
        onOpenChange={(open) => { if (!open) setCancelRideId(null); }}
        title="Cancel this trip?"
        description="This trip will be cancelled and the driver will be notified."
        confirmLabel="Cancel trip"
        onConfirm={async () => { if (cancelRideId !== null) await cancelRide(cancelRideId); setCancelRideId(null); }}
      />
    </main>
  );
}
