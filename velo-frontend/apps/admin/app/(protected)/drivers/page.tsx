import { PageFrame } from "../_components/page-frame";

const drivers = [
  { name: "Amina Diallo", status: "Pending review", vehicle: "Toyota Sienna", tone: "warning" },
  { name: "Carlos Mendes", status: "Approved", vehicle: "Honda Odyssey", tone: "success" },
  { name: "Jordan Lee", status: "Docs missing", vehicle: "Kia Carnival", tone: "danger" }
] as const;

export default function DriversPage() {
  return (
    <div className="stack">
      <PageFrame
        title="Drivers"
        description="Review onboarding, documents, and approval status for new drivers."
      />
      <section className="panel metric-card">
        <div className="list">
          {drivers.map((driver) => (
            <div key={driver.name} className="list-item">
              <div>
                <strong>{driver.name}</strong>
                <p>{driver.vehicle}</p>
              </div>
              <span className="badge" data-tone={driver.tone}>
                {driver.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
