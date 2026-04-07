"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { validatePointInput, validateScheduleInput } from "../_lib/ride-forms";
import { requestRiderProxy, type SpringPage } from "../_lib/rider-client";

type ScheduledRide = {
  id: number;
  scheduledTime: string;
  status: string;
  paymentMethod: string;
  fare?: number | string;
};

function unwrapPage(payload: unknown): ScheduledRide[] {
  const root = payload as Record<string, unknown> | null;
  const raw = (root?.data as Record<string, unknown> | undefined) ?? root ?? {};
  return (raw.content as ScheduledRide[] | undefined) ?? [];
}

export default function RiderScheduledPage() {
  const [rides, setRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [pickupLat, setPickupLat] = useState("12.9716");
  const [pickupLng, setPickupLng] = useState("77.5946");
  const [dropLat, setDropLat] = useState("12.9352");
  const [dropLng, setDropLng] = useState("77.6245");
  const [paymentMethod, setPaymentMethod] = useState("WALLET");
  const [scheduledTime, setScheduledTime] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const loadRides = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await requestRiderProxy<SpringPage<ScheduledRide>>("riders/scheduled-rides?page=0&size=20");
      setRides(unwrapPage(payload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load scheduled rides.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  async function scheduleRide() {
    setError(null);
    setMessage(null);
    setPending(true);

    const pickup = validatePointInput({ lat: pickupLat, lng: pickupLng }, "Pickup");
    const drop = validatePointInput({ lat: dropLat, lng: dropLng }, "Drop-off");
    const when = validateScheduleInput(scheduledTime);

    if (!pickup.ok) {
      setError(pickup.error);
      setPending(false);
      return;
    }
    if (!drop.ok) {
      setError(drop.error);
      setPending(false);
      return;
    }
    if (!when.ok) {
      setError(when.error);
      setPending(false);
      return;
    }

    try {
      await requestRiderProxy("/riders/schedule-ride", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pickupLocation: pickup.point,
          dropOffLocation: drop.point,
          paymentMethod,
          scheduledTime
        })
      });

      setMessage("Ride scheduled successfully.");
      setScheduledTime("");
      await loadRides();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Unable to schedule ride.");
    } finally {
      setPending(false);
    }
  }

  async function rescheduleRide(rideId: number) {
    setError(null);
    setMessage(null);
    setPending(true);

    const validation = validateScheduleInput(rescheduleTime);
    if (!validation.ok) {
      setError(validation.error);
      setPending(false);
      return;
    }

    try {
      const encodedTime = encodeURIComponent(rescheduleTime);
      await requestRiderProxy(`/riders/scheduled-rides/${rideId}/reschedule?newTime=${encodedTime}`, {
        method: "PUT"
      });

      setMessage(`Ride #${rideId} rescheduled.`);
      await loadRides();
    } catch (rescheduleError) {
      setError(rescheduleError instanceof Error ? rescheduleError.message : "Unable to reschedule ride.");
    } finally {
      setPending(false);
    }
  }

  async function cancelRide(rideId: number) {
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      await requestRiderProxy(`/riders/scheduled-rides/${rideId}`, {
        method: "DELETE"
      });

      setMessage(`Ride #${rideId} canceled.`);
      await loadRides();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel scheduled ride.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Scheduled rides</p>
        <h1>Plan future trips</h1>
        <p>Create, reschedule, or cancel upcoming rides.</p>
      </section>

      <section className="card stack">
        <strong>Schedule a new ride</strong>
        <div className="grid grid-2">
          <label className="field">
            <span>Pickup latitude</span>
            <input value={pickupLat} onChange={(event) => setPickupLat(event.target.value)} />
          </label>
          <label className="field">
            <span>Pickup longitude</span>
            <input value={pickupLng} onChange={(event) => setPickupLng(event.target.value)} />
          </label>
          <label className="field">
            <span>Drop-off latitude</span>
            <input value={dropLat} onChange={(event) => setDropLat(event.target.value)} />
          </label>
          <label className="field">
            <span>Drop-off longitude</span>
            <input value={dropLng} onChange={(event) => setDropLng(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Payment method</span>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="WALLET">Wallet</option>
            <option value="CASH">Cash</option>
          </select>
        </label>
        <label className="field">
          <span>Scheduled time</span>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(event) => setScheduledTime(event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={() => void scheduleRide()} disabled={pending}>
          {pending ? "Submitting..." : "Schedule ride"}
        </button>
      </section>

      <section className="card stack">
        <strong>Your scheduled rides</strong>
        <label className="field">
          <span>Reschedule time (used by reschedule buttons)</span>
          <input
            type="datetime-local"
            value={rescheduleTime}
            onChange={(event) => setRescheduleTime(event.target.value)}
          />
        </label>
        {loading ? <p className="helper">Loading scheduled rides...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}

        {!loading && !error && rides.length === 0 ? <p className="helper">No scheduled rides yet.</p> : null}

        {!loading && !error && rides.length > 0 ? (
          <div className="list">
            {rides.map((ride) => (
              <article key={ride.id} className="list-item">
                <div>
                  <strong>Ride #{ride.id}</strong>
                  <p>
                    {ride.status} • {ride.paymentMethod}
                  </p>
                  <p>{new Date(ride.scheduledTime).toLocaleString()}</p>
                </div>
                <div className="actions">
                  <button className="primary-button" type="button" disabled={pending} onClick={() => void rescheduleRide(ride.id)}>
                    Reschedule
                  </button>
                  <button className="primary-button" type="button" disabled={pending} onClick={() => void cancelRide(ride.id)}>
                    Cancel
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="actions">
        <Link href="/" className="primary-button">Back to booking</Link>
        <Link href="/rides" className="primary-button">Ride history</Link>
      </section>
    </main>
  );
}
