"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Money, Section, Skeleton, StatCard } from "@velo/ui";
import { formatMoney } from "@velo/app-core/formatters";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type RevenueRow } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";

type PeriodStats = { revenue: number; rides: number };

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function dateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { start: isoDate(start), end: isoDate(end) };
}
function numeric(value: number | string | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function aggregate(rows: RevenueRow[]): PeriodStats {
  return rows.reduce((total, row) => ({ revenue: total.revenue + numeric(row.grossRevenue), rides: total.rides + numeric(row.rideCount) }), { revenue: 0, rides: 0 });
}

function RevenueChart({ rows }: { rows: RevenueRow[] }) {
  const values = useMemo(() => {
    const byDate = new Map(rows.map((row) => [row.date.slice(0, 10), numeric(row.grossRevenue)]));
    const range = dateRange(30);
    const days: Array<{ date: string; amount: number }> = [];
    const current = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    while (current <= end) {
      const date = isoDate(current);
      days.push({ date, amount: byDate.get(date) ?? 0 });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [rows]);

  const width = 960;
  const height = 280;
  const left = 58;
  const right = 16;
  const top = 20;
  const bottom = 48;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(1, ...values.map((item) => item.amount));
  const gap = 4;
  const barWidth = (chartWidth - gap * values.length) / values.length;
  const ticks = [0, 0.5, 1];
  const titleId = "revenue-chart-title";
  const descriptionId = "revenue-chart-description";

  return (
    <div className="admin-chart-scroll">
      <svg className="admin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`} tabIndex={0}>
        <title id={titleId}>Daily gross revenue for the last 30 days</title>
        <desc id={descriptionId}>{values.length ? `Thirty daily bars. Highest daily revenue was ${formatMoney(max)}.` : "No daily revenue values are available."}</desc>
        {ticks.map((tick) => {
          const y = top + chartHeight * (1 - tick);
          return <g key={tick}><line className="chart-grid" x1={left} x2={width - right} y1={y} y2={y} /><text x={left - 8} y={y + 4} textAnchor="end">{formatMoney(max * tick, "USD", "en-US")}</text></g>;
        })}
        <line className="chart-baseline" x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} />
        {values.map((item, index) => {
          const barHeight = (item.amount / max) * chartHeight;
          const x = left + gap + index * (barWidth + gap);
          const y = top + chartHeight - barHeight;
          const tickDate = new Date(`${item.date}T00:00:00`);
          return <g key={item.date}><rect className="chart-bar" x={x} y={y} width={Math.max(1, barWidth)} height={Math.max(1, barHeight)} rx="2"><title>{`${item.date}: ${formatMoney(item.amount)}`}</title></rect>{(index % 5 === 0 || index === values.length - 1) ? <text x={x + barWidth / 2} y={height - 14} textAnchor="middle">{new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(tickDate)}</text> : null}</g>;
        })}
      </svg>
      <table className="sr-only" aria-label="Daily revenue values">
        <thead><tr><th scope="col">Date</th><th scope="col">Gross revenue</th></tr></thead>
        <tbody>{values.map((item) => <tr key={item.date}><th scope="row">{item.date}</th><td>{formatMoney(item.amount)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function RevenuePage() {
  const [today, setToday] = useState<PeriodStats | null>(null);
  const [week, setWeek] = useState<PeriodStats | null>(null);
  const [month, setMonth] = useState<PeriodStats | null>(null);
  const [dailyRows, setDailyRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const todayRange = dateRange(1);
        const weekRange = dateRange(7);
        const monthRange = dateRange(30);
        const [todayRows, weekRows, monthRows] = await Promise.all([
          adminClient.getRevenue(todayRange.start, todayRange.end),
          adminClient.getRevenue(weekRange.start, weekRange.end),
          adminClient.getRevenue(monthRange.start, monthRange.end),
        ]);
        if (!isMounted) return;
        setToday(aggregate(todayRows));
        setWeek(aggregate(weekRows));
        setMonth(aggregate(monthRows));
        setDailyRows(monthRows);
      } catch (loadError) {
        if (isMounted) setError(toActionErrorMessage(loadError, "Couldn't load revenue."));
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void load();
    return () => { isMounted = false; };
  }, [reloadVersion]);

  const hasRevenue = dailyRows.some((row) => numeric(row.grossRevenue) > 0 || numeric(row.rideCount) > 0);

  return (
    <div className="stack">
      <PageFrame title="Revenue" description="Track daily, weekly, and monthly platform performance." />
      {error ? <ErrorState title="Couldn't load revenue" description={error} onRetry={() => setReloadVersion((value) => value + 1)} /> : null}
      {loading ? <div className="dashboard-kpis" aria-label="Loading revenue" aria-busy="true">{Array.from({ length: 3 }, (_, index) => <Skeleton className="h-28" key={index} />)}</div> : null}
      {!loading && today && week && month ? (
        <>
          <div className="dashboard-kpis">
            <StatCard title="Today" value={<Money amount={today.revenue} />} helperText={`${today.rides} completed rides`} />
            <StatCard title="This week" value={<Money amount={week.revenue} />} helperText={`${week.rides} completed rides`} />
            <StatCard title="Last 30 days" value={<Money amount={month.revenue} />} helperText={`${month.rides} completed rides`} />
          </div>
          <Section title="Daily revenue · last 30 days">
            {hasRevenue ? <RevenueChart rows={dailyRows} /> : <EmptyState title="No revenue recorded yet" description="Daily revenue will appear here after completed rides." action={<Link className="secondary-button" href="/dispatch">Open dispatch</Link>} />}
          </Section>
          <Section title="Driver earnings">
            <EmptyState title="Driver breakdown isn't available" description="The revenue feed reports driver earnings as daily totals, without names or per-driver amounts." action={<Link className="secondary-button" href="/drivers">Review drivers</Link>} />
          </Section>
        </>
      ) : null}
    </div>
  );
}
