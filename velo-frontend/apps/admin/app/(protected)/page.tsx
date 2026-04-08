"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./_components/metric-card";
import { PageFrame } from "./_components/page-frame";
import { adminClient, type DashboardStats } from "./_lib/admin-client";
import { toCurrency } from "./_lib/http";

type Metric = {
  label: string;
  value: string;
  detail: string;
};

type QueueItem = {
  title: string;
  meta: string;
  tone: "warning" | "success";
};

const initialMetrics: Metric[] = [
  { label: "Active rides", value: "N/A", detail: "Waiting for live data" },
  { label: "Pending drivers", value: "N/A", detail: "Waiting for live data" },
  { label: "Open payouts", value: "N/A", detail: "Waiting for live data" },
  { label: "Revenue today", value: "N/A", detail: "Waiting for live data" },
];

const initialQueue: QueueItem[] = [
  { title: "Driver approvals", meta: "Waiting for live data", tone: "warning" },
  { title: "Payout review", meta: "Waiting for live data", tone: "warning" },
  { title: "Promo audit", meta: "Waiting for live data", tone: "warning" },
];

function pluralize(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function readRevenueForToday(stats: DashboardStats, dateKey: string): number | string | undefined {
  if (dateKey in stats.revenueByDay) {
    return stats.revenueByDay[dateKey];
  }

  const latestDay = Object.keys(stats.revenueByDay).sort().at(-1);
  if (!latestDay) {
    return undefined;
  }

  return stats.revenueByDay[latestDay];
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics);
  const [queueItems, setQueueItems] = useState<QueueItem[]>(initialQueue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      setMetrics(initialMetrics);
      setQueueItems(initialQueue);

      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10);

      try {
        const [dashboard, daily, pendingDrivers, pendingPayouts, promoCodes] = await Promise.all([
          adminClient.getDashboardStats(),
          adminClient.getDailyStats(dateKey),
          adminClient.getPendingDrivers(0, 1),
          adminClient.getPendingPayouts(0, 1),
          adminClient.getPromoCodes(),
        ]);

        if (!isMounted) {
          return;
        }

        const pendingDriverCount = pendingDrivers.totalElements || dashboard.pendingApprovals || 0;
        const payoutCount = pendingPayouts.totalElements || 0;
        const inactivePromoCount = promoCodes.filter((promo) => !promo.active).length;
        const todayRevenue = daily.totalRevenue ?? readRevenueForToday(dashboard, dateKey);

        setMetrics([
          {
            label: "Active rides",
            value: String(dashboard.activeRides),
            detail: `${pluralize(dashboard.totalRides, "ride", "rides")} tracked overall`,
          },
          {
            label: "Pending drivers",
            value: String(pendingDriverCount),
            detail: pendingDriverCount > 0 ? "Awaiting approval" : "No pending approvals",
          },
          {
            label: "Open payouts",
            value: String(payoutCount),
            detail: payoutCount > 0 ? "Needs review today" : "No open payouts",
          },
          {
            label: "Revenue today",
            value: toCurrency(todayRevenue),
            detail: `${pluralize(daily.totalRides ?? 0, "ride", "rides")} today`,
          },
        ]);

        setQueueItems([
          {
            title: "Driver approvals",
            meta: `${pluralize(pendingDriverCount, "pending application", "pending applications")}`,
            tone: pendingDriverCount > 0 ? "warning" : "success",
          },
          {
            title: "Payout review",
            meta: `${pluralize(payoutCount, "pending payout", "pending payouts")}`,
            tone: payoutCount > 0 ? "warning" : "success",
          },
          {
            title: "Promo audit",
            meta:
              inactivePromoCount > 0
                ? `${pluralize(inactivePromoCount, "inactive promo", "inactive promos")}`
                : "All promo codes active",
            tone: inactivePromoCount > 0 ? "warning" : "success",
          },
        ]);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data.");
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
  }, [reloadVersion]);

  return (
    <div className="stack">
      <PageFrame
        title="Dashboard"
        description="Track ride operations, approvals, and revenue from one place."
      />

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setReloadVersion((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      {loading ? <p className="helper">Loading dashboard data...</p> : null}

      <section className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="cards-grid">
        <article className="panel metric-card">
          <small>Today’s queue</small>
          <div className="list">
            {queueItems.map((item) => (
                <div key={item.title} className="list-item">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.meta}</p>
                  </div>
                  <span className="badge" data-tone={item.tone}>
                    {item.tone === "success" ? "Ready" : "Needs action"}
                  </span>
                </div>
              ))}
          </div>
        </article>

        <article className="panel metric-card">
          <small>Launch checklist</small>
          <div className="list">
            <div className="list-item">
              <div>
                <strong>Backend auth proxy</strong>
                <p>Cookie-based session bridge is in place.</p>
              </div>
              <span className="badge" data-tone="success">
                Done
              </span>
            </div>
            <div className="list-item">
              <div>
                <strong>Protected routes</strong>
                <p>Admin sections redirect unauthenticated users.</p>
              </div>
              <span className="badge" data-tone="success">
                Done
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
