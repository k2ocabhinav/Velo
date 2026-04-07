import { PageFrame } from "../_components/page-frame";

const scheduledRides = [
  { rider: "Rita Okafor", when: "Today, 4:30 PM", tone: "warning" },
  { rider: "James Keller", when: "Tomorrow, 9:00 AM", tone: "success" },
  { rider: "Mina Yusuf", when: "Friday, 6:15 PM", tone: "success" }
] as const;

export default function ScheduledRidesPage() {
  return (
    <div className="stack">
      <PageFrame title="Scheduled rides" description="Review pre-booked trips and upcoming ride reservations." />
      <section className="panel metric-card">
        <div className="list">
          {scheduledRides.map((ride) => (
            <div key={ride.rider} className="list-item">
              <div>
                <strong>{ride.rider}</strong>
                <p>{ride.when}</p>
              </div>
              <span className="badge" data-tone={ride.tone}>
                Confirmed
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
