import { PageFrame } from "../_components/page-frame";

const promos = [
  { code: "VELO10", status: "Active", tone: "success" },
  { code: "SUMMER15", status: "Scheduled", tone: "warning" },
  { code: "PAUSED25", status: "Disabled", tone: "danger" }
] as const;

export default function PromoCodesPage() {
  return (
    <div className="stack">
      <PageFrame title="Promo codes" description="Create, pause, and monitor discount campaigns." />
      <section className="panel metric-card">
        <div className="list">
          {promos.map((promo) => (
            <div key={promo.code} className="list-item">
              <div>
                <strong>{promo.code}</strong>
                <p>Campaign rules and usage controls will live here.</p>
              </div>
              <span className="badge" data-tone={promo.tone}>
                {promo.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
