import { MetricCard } from "./_components/metric-card";
import { PageFrame } from "./_components/page-frame";

const metrics = [
  { label: "Active rides", value: "128", detail: "+12 since last hour" },
  { label: "Pending drivers", value: "14", detail: "Awaiting approval" },
  { label: "Open payouts", value: "9", detail: "Needs review today" },
  { label: "Revenue today", value: "$24.8k", detail: "Up 8.4% from yesterday" }
];

const queueItems = [
  { title: "Driver approvals", meta: "14 pending", tone: "warning" },
  { title: "Payout review", meta: "9 items", tone: "warning" },
  { title: "Promo audit", meta: "3 rules changed", tone: "success" }
] as const;

export default function DashboardPage() {
  return (
    <div className="stack">
      <PageFrame
        title="Dashboard"
        description="Track ride operations, approvals, and revenue from one place."
      />

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
