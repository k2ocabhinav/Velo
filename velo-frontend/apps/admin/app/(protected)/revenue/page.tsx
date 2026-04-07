"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type RevenueRow } from "../_lib/admin-client";
import { toCurrency } from "../_lib/http";

type RevenueMetric = {
  label: string;
  value: string;
  detail: string;
};

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildDateRange(days: number): { start: string; end: string } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  return { start: formatIsoDate(startDate), end: formatIsoDate(endDate) };
}

function toNumber(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function aggregateRevenue(rows: RevenueRow[]): { gross: number; rides: number } {
  return rows.reduce(
    (acc, row) => {
      acc.gross += toNumber(row.grossRevenue);
      acc.rides += typeof row.rideCount === "number" ? row.rideCount : 0;
      return acc;
    },
    { gross: 0, rides: 0 },
  );
}

export default function RevenuePage() {
  const [metrics, setMetrics] = useState<RevenueMetric[]>([
    { label: "Today", value: "N/A", detail: "Waiting for live data" },
    { label: "This week", value: "N/A", detail: "Waiting for live data" },
    { label: "This month", value: "N/A", detail: "Waiting for live data" },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const todayRange = buildDateRange(1);
        const weekRange = buildDateRange(7);
        const monthRange = buildDateRange(30);

        const [todayRows, weekRows, monthRows] = await Promise.all([
          adminClient.getRevenue(todayRange.start, todayRange.end),
          adminClient.getRevenue(weekRange.start, weekRange.end),
          adminClient.getRevenue(monthRange.start, monthRange.end),
        ]);

        if (!isMounted) {
          return;
        }

        const today = aggregateRevenue(todayRows);
        const week = aggregateRevenue(weekRows);
        const month = aggregateRevenue(monthRows);

        setMetrics([
          {
            label: "Today",
            value: toCurrency(today.gross),
            detail: `${today.rides} completed rides`,
          },
          {
            label: "This week",
            value: toCurrency(week.gross),
            detail: `${week.rides} completed rides`,
          },
          {
            label: "This month",
            value: toCurrency(month.gross),
            detail: `${month.rides} completed rides`,
          },
        ]);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load revenue data.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="stack">
      <PageFrame title="Revenue" description="Track daily, weekly, and monthly platform revenue." />

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="helper">Loading revenue metrics...</p> : null}

      <section className="metric-grid">
        {metrics.map((row) => (
          <article key={row.label} className="panel metric-card">
            <small>{row.label}</small>
            <strong>{row.value}</strong>
            <span>{row.detail}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
