"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  requestDriverProxy,
  toCurrency,
  toRelativeTimestamp,
  type DriverRide,
  type SpringPage,
} from "../_lib/driver-client";

const PAGE_SIZE = 10;

export default function DriverRidesPage() {
  const [items, setItems] = useState<DriverRide[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRides = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await requestDriverProxy<SpringPage<DriverRide>>(
        `drivers/getMyRides?pageOffset=${requestedPage}&pageSize=${PAGE_SIZE}`,
      );
      const content = Array.isArray(response.content) ? response.content : [];
      setItems(content);
      setPage(Number.isFinite(response.number) ? Number(response.number) : requestedPage);
      setTotalPages(Math.max(Number.isFinite(response.totalPages) ? Number(response.totalPages) : 1, 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load rides.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides(0);
  }, [loadRides]);

  return (
    <main className="stack">
      <section className="hero">
        <p className="badge">Ride History</p>
        <h1>Review completed and active rides</h1>
        <p>Use this page to inspect ride status, fares, and transition into detailed ride actions.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <strong>Your rides</strong>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void loadRides(page)}>
            Refresh
          </button>
        </div>

        {loading ? <p className="helper">Loading rides...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!loading && !error && items.length === 0 ? <p className="helper">No rides found yet.</p> : null}

        {!loading && !error && items.length > 0 ? (
          <div className="list">
            {items.map((ride) => (
              <article className="list-item" key={ride.id}>
                <div className="stack compact">
                  <strong>Ride #{ride.id}</strong>
                  <p className="helper">
                    Status: {ride.rideStatus} • Payment: {ride.paymentMethod}
                  </p>
                  <p className="helper">Created: {toRelativeTimestamp(ride.createdTime)}</p>
                </div>
                <div className="stack compact" style={{ justifyItems: "end" }}>
                  <span className="badge">{toCurrency(ride.fair)}</span>
                  <Link className="secondary-button" href={`/ride/${ride.id}`}>
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="actions">
          <button
            className="secondary-button"
            type="button"
            disabled={loading || page <= 0}
            onClick={() => void loadRides(Math.max(page - 1, 0))}
          >
            Previous
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={loading || page + 1 >= totalPages}
            onClick={() => void loadRides(page + 1)}
          >
            Next
          </button>
          <span className="helper">
            Page {page + 1} of {totalPages}
          </span>
        </div>
      </section>
    </main>
  );
}
