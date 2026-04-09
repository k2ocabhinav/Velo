"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { requestDriverProxy, toCurrency, toRelativeTimestamp, type DriverRide, type SpringPage } from "../_lib/driver-client";
import {
  formatMapPoint,
  getDriverRideFareValue,
  getDriverRideStatusLabel,
  normalizeDriverRidePage,
  selectCurrentDriverRide,
  toMapPoint,
} from "../_lib/driver-ride-state";

const PAGE_SIZE = 10;

export default function DriverRidesPage() {
  const [items, setItems] = useState<DriverRide[]>([]);
  const [activeRide, setActiveRide] = useState<DriverRide | null>(null);
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
      const content = normalizeDriverRidePage(response);
      setItems(content);
      setActiveRide(selectCurrentDriverRide(content));
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
          <strong>Current ride lane</strong>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void loadRides(page)}>
            Refresh
          </button>
        </div>
        {loading ? <p className="helper">Loading ride lane...</p> : null}
        {!loading && !activeRide ? (
          <p className="helper">No active ride right now. Active trips appear here automatically.</p>
        ) : null}
        {!loading && activeRide ? (
          <article className="list-item">
            <div className="stack compact">
              <strong>Ride #{activeRide.id}</strong>
              <p className="helper">{getDriverRideStatusLabel(activeRide.rideStatus)}</p>
              <p className="helper">
                Rider: {activeRide.rider?.user?.name ?? activeRide.rider?.user?.email ?? "Assigned rider"}
              </p>
            </div>
            <div className="stack compact" style={{ justifyItems: "end" }}>
              <span className="badge">{toCurrency(getDriverRideFareValue(activeRide))}</span>
              <Link className="primary-button" href={`/ride/${activeRide.id}`}>
                Open control center
              </Link>
            </div>
          </article>
        ) : null}
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
            {items.map((ride) => {
              const pickup = toMapPoint(ride.pickupLocation);
              const dropOff = toMapPoint(ride.dropOffLocation);
              return (
                <article className="list-item" key={ride.id}>
                  <div className="stack compact">
                    <strong>Ride #{ride.id}</strong>
                    <p className="helper">
                      Status: {getDriverRideStatusLabel(ride.rideStatus)} • Payment: {ride.paymentMethod}
                    </p>
                    <p className="helper">
                      Rider: {ride.rider?.user?.name ?? ride.rider?.user?.email ?? "Assigned rider"}
                    </p>
                    <p className="helper">Pickup: {formatMapPoint(pickup)} • Drop-off: {formatMapPoint(dropOff)}</p>
                    <p className="helper">Created: {toRelativeTimestamp(ride.createdTime)}</p>
                  </div>
                  <div className="stack compact" style={{ justifyItems: "end" }}>
                    <span className="badge">{toCurrency(getDriverRideFareValue(ride))}</span>
                    <Link className="secondary-button" href={`/ride/${ride.id}`}>
                      Open
                    </Link>
                  </div>
                </article>
              );
            })}
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
