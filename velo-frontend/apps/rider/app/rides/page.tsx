"use client";

import { useCallback, useEffect, useState } from "react";
import { requestRiderProxy, toCurrency, type DecimalValue, type SpringPage } from "../_lib/rider-client";

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

function toPageInfo(payload: SpringPage<RideItem>, fallbackPage: number) {
  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    number: typeof payload.number === "number" ? payload.number : fallbackPage,
    totalPages: Math.max(typeof payload.totalPages === "number" ? payload.totalPages : 1, 1),
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function canCancel(status: string): boolean {
  const normalized = status.toUpperCase();
  return normalized !== "CANCELLED" && normalized !== "ENDED";
}

export default function RiderRidesPage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRides = useCallback(async (targetPage: number): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await requestRiderProxy<SpringPage<RideItem>>(
        `riders/getMyRides?pageOffset=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      const parsed = toPageInfo(response, targetPage);
      setRides(parsed.content);
      setPage(parsed.number);
      setTotalPages(parsed.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ride history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides(0);
  }, [loadRides]);

  async function cancelRide(rideId: number): Promise<void> {
    setPendingId(rideId);
    setError(null);
    setMessage(null);

    try {
      await requestRiderProxy<RideItem>(`riders/cancelRide/${rideId}`, { method: "POST" });
      setMessage(`Ride #${rideId} canceled.`);
      await loadRides(page);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel ride.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Rides</p>
        <h1>Your ride history</h1>
        <p>Track ongoing and completed rides, and cancel when eligible.</p>
      </section>

      <section className="card stack">
        {loading ? <p className="helper">Loading rides...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
        {!loading && !error && rides.length === 0 ? <p className="helper">No rides found.</p> : null}

        {!loading && !error && rides.length > 0 ? (
          <div className="list">
            {rides.map((ride) => (
              <article key={ride.id} className="list-item">
                <div className="stack" style={{ gap: 6 }}>
                  <strong>Ride #{ride.id}</strong>
                  <p>Status: {ride.rideStatus}</p>
                  <p>
                    Created: {formatDateTime(ride.createdTime)}
                    {" • "}
                    Started: {formatDateTime(ride.startedAt)}
                  </p>
                </div>
                <div className="stack" style={{ justifyItems: "end", gap: 8 }}>
                  <span className="badge">
                    {ride.paymentMethod} • {toCurrency(ride.fare ?? ride.fair ?? null)}
                  </span>
                  {canCancel(ride.rideStatus) ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={pendingId === ride.id}
                      onClick={() => void cancelRide(ride.id)}
                    >
                      {pendingId === ride.id ? "Canceling..." : "Cancel ride"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="actions" style={{ justifyContent: "space-between" }}>
          <button
            className="primary-button"
            type="button"
            disabled={loading || page <= 0}
            onClick={() => void loadRides(page - 1)}
          >
            Previous
          </button>
          <p className="helper">
            Page {page + 1} of {totalPages}
          </p>
          <button
            className="primary-button"
            type="button"
            disabled={loading || page + 1 >= totalPages}
            onClick={() => void loadRides(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}
