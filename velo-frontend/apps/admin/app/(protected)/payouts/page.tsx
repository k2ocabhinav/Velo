import { PageFrame } from "../_components/page-frame";

const payouts = [
  { label: "Driver payout #4821", status: "Pending approval", tone: "warning" },
  { label: "Driver payout #4820", status: "Processed", tone: "success" },
  { label: "Driver payout #4819", status: "Flagged", tone: "danger" }
] as const;

export default function PayoutsPage() {
  return (
    <div className="stack">
      <PageFrame title="Payouts" description="Review queued payouts before they are processed." />
      <section className="panel metric-card">
        <div className="list">
          {payouts.map((payout) => (
            <div key={payout.label} className="list-item">
              <div>
                <strong>{payout.label}</strong>
                <p>Verify amount, destination, and settlement status.</p>
              </div>
              <span className="badge" data-tone={payout.tone}>
                {payout.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
