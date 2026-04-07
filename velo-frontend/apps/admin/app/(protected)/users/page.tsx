import { PageFrame } from "../_components/page-frame";

const users = [
  { name: "Nora Hart", status: "Active rider", tone: "success" },
  { name: "Samir Patel", status: "Needs verification", tone: "warning" },
  { name: "Elena Stone", status: "Suspended", tone: "danger" }
] as const;

export default function UsersPage() {
  return (
    <div className="stack">
      <PageFrame title="Users" description="Monitor rider and driver accounts, status changes, and notes." />
      <section className="panel metric-card">
        <div className="list">
          {users.map((user) => (
            <div key={user.name} className="list-item">
              <div>
                <strong>{user.name}</strong>
                <p>Account lifecycle and support actions.</p>
              </div>
              <span className="badge" data-tone={user.tone}>
                {user.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
