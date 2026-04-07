import { PageFrame } from "../_components/page-frame";

const revenueRows = [
  { label: "Today", value: "$24.8k", detail: "82 completed rides" },
  { label: "This week", value: "$168.2k", detail: "Up 8.1%" },
  { label: "This month", value: "$624.1k", detail: "Top city: Lagos" }
] as const;

export default function RevenuePage() {
  return (
    <div className="stack">
      <PageFrame title="Revenue" description="Track daily, weekly, and monthly platform revenue." />
      <section className="metric-grid">
        {revenueRows.map((row) => (
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
