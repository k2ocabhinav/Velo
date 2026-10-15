"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, Money, Section, StatCard } from "@velo/ui";
import { getTenantLabelForCount, getTenantPluralLabel } from "@velo/app-core/tenant";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { PageFrame } from "./_components/page-frame";
import { adminClient, type AdminOpsHealth, type DashboardStats } from "./_lib/admin-client";
import { toActionErrorMessage } from "./_lib/ui-state";

type DashboardData = {
  stats: DashboardStats;
  todayRevenue: number | string;
  todayRides: number;
  pendingDrivers: number;
  openPayouts: number;
  inactivePromos: number;
  unassignedScheduledTrips: number;
  health: AdminOpsHealth;
};

export default function DashboardPage() {
  const { driverLabel, tripLabel } = useTenantBrandingOrDefault();
  const drivers = getTenantPluralLabel(driverLabel, "Driver");
  const trips = getTenantPluralLabel(tripLabel, "Trip");
  const usesDefaultTripLabel = tripLabel.trim().toLowerCase() === "trip";
  const dashboardTripLabel = usesDefaultTripLabel ? "rides" : trips.toLowerCase();
  const dashboardTripNoun = usesDefaultTripLabel ? "Ride" : tripLabel;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const dateKey = new Date().toISOString().slice(0, 10);
        const [stats, daily, drivers, payouts, promos, health, unassignedScheduledTrips] = await Promise.all([
          adminClient.getDashboardStats(),
          adminClient.getDailyStats(dateKey),
          adminClient.getPendingDrivers(0, 1),
          adminClient.getPendingPayouts(0, 1),
          adminClient.getPromoCodes(),
          adminClient.getOpsHealth(),
          adminClient.getTripsNeedingAttentionCount(),
        ]);
        if (!isMounted) return;
        setData({
          stats,
          todayRevenue: daily.totalRevenue ?? stats.revenueByDay[dateKey] ?? stats.totalRevenue,
          todayRides: daily.totalRides ?? 0,
          pendingDrivers: drivers.totalElements || stats.pendingApprovals || 0,
          openPayouts: payouts.totalElements || 0,
          inactivePromos: promos.filter((promo) => !promo.active).length,
          unassignedScheduledTrips,
          health,
        });
      } catch (loadError) {
        if (isMounted) setError(toActionErrorMessage(loadError, "Couldn't load the dashboard."));
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void load();
    return () => { isMounted = false; };
  }, [reloadVersion]);

  const hasAttention = Boolean(data && (data.pendingDrivers || data.openPayouts || data.inactivePromos || data.unassignedScheduledTrips));
  const degraded = Boolean(data && (!data.health.redisAvailable || data.health.cacheErrors > 0));

  return (
    <div className="stack">
      <PageFrame title="Dashboard" description={`A live view of ${dashboardTripLabel}, reviews, and revenue.`} />

      {error ? <ErrorState title="Couldn't load dashboard data" description={error} onRetry={() => setReloadVersion((value) => value + 1)} /> : null}

      {loading ? (
        <div className="dashboard-kpis" aria-label="Loading dashboard" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => <StatCard.Skeleton key={index} />)}
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="dashboard-kpis">
            <Link className="dashboard-kpi-link" href="/dispatch" aria-label={`${data.stats.activeRides} active ${dashboardTripLabel}, view dispatch`}>
              <StatCard title={`Active ${dashboardTripLabel}`} value={data.stats.activeRides} helperText="Live on dispatch" />
            </Link>
            <Link className="dashboard-kpi-link" href="/drivers" aria-label={`${data.pendingDrivers} pending ${drivers.toLowerCase()}, review ${drivers.toLowerCase()}`}>
              <StatCard title={`Pending ${drivers.toLowerCase()}`} value={data.pendingDrivers} helperText="Applications to review" />
            </Link>
            <Link className="dashboard-kpi-link" href="/payouts" aria-label={`${data.openPayouts} open payouts, review payouts`}>
              <StatCard title="Open payouts" value={data.openPayouts} helperText="Requests awaiting review" />
            </Link>
            <Link className="dashboard-kpi-link" href="/revenue" aria-label="Today's revenue, view revenue">
              <StatCard title="Revenue today" value={<Money amount={data.todayRevenue} />} helperText={`${data.todayRides} ${getTenantLabelForCount(data.todayRides, dashboardTripNoun, { midSentence: true, fallback: "Ride" })}`} />
            </Link>
          </div>

          <Section title="Needs attention">
            {!hasAttention ? (
              <EmptyState
                title="You're all caught up"
                description={`There are no ${driverLabel.toLowerCase()} applications, payouts, inactive promos, or near-term ${trips.toLowerCase()} waiting for action.`}
                action={<Link className="secondary-button" href="/dispatch">Review dispatch</Link>}
              />
            ) : (
              <div className="needs-attention-list">
                {[
                  { label: `${driverLabel} approvals`, count: data.pendingDrivers, href: "/drivers", action: `Review ${drivers.toLowerCase()}` },
                  { label: "Payout review", count: data.openPayouts, href: "/payouts", action: "Review payouts" },
                  { label: "Inactive promo codes", count: data.inactivePromos, href: "/promo-codes", action: "Review promos" },
                  { label: `Unassigned scheduled ${trips.toLowerCase()}`, count: data.unassignedScheduledTrips, href: "/trip-sheet", action: `Assign ${drivers.toLowerCase()}` },
                ].filter((item) => item.count > 0).map((item) => (
                  <div className="needs-attention-item" key={item.label}>
                    <div><strong>{item.label}</strong><p>{getTenantLabelForCount(item.count, "item", { midSentence: true })} {item.count === 1 ? "needs" : "need"} review</p></div>
                    <Link className="secondary-button" href={item.href}>{item.action}</Link>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Operations status">
            <div className="health-row">
              <span className="status-badge" data-tone={degraded ? "danger" : "success"}>{degraded ? "Needs attention" : "All systems normal"}</span>
              <p>{degraded ? "Redis or cache errors need attention." : "All systems normal."}</p>
              <p>{data.health.dispatchQueueDepth} open offers</p>
              {data.health.expiredOfferCount > 0 ? <p>{data.health.expiredOfferCount} expired offers</p> : null}
              {degraded ? <Link className="secondary-button" href="/dispatch">Open dispatch</Link> : null}
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}
