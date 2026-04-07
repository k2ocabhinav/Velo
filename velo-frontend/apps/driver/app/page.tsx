const sections = [
  {
    title: "Availability",
    description: "Online/offline state and incoming requests will live here.",
    status: "Planned"
  },
  {
    title: "Active ride",
    description: "OTP, navigation, and end-ride controls will be added later.",
    status: "Ready for API wiring"
  },
  {
    title: "Earnings",
    description: "Daily, weekly, and monthly earnings views.",
    status: "Placeholder"
  }
] as const;

export default function DriverHomePage() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="badge">Driver shell</p>
        <h1>Driver control starts here.</h1>
        <p>
          This workspace is a clean starter for the driver experience and will be expanded in Phase 3.
        </p>
      </section>

      <section className="grid">
        {sections.map((section) => (
          <article className="card" key={section.title}>
            <small>{section.status}</small>
            <strong>{section.title}</strong>
            <p>{section.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
