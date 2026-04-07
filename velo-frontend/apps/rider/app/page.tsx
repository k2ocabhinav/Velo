const sections = [
  {
    title: "Book a ride",
    description: "Map and fare flow will live here in Phase 2.",
    status: "Planned"
  },
  {
    title: "Ride history",
    description: "Past trips and receipts will appear here.",
    status: "Ready for API wiring"
  },
  {
    title: "Wallet and promos",
    description: "Payments, wallet balance, and promo code tools.",
    status: "Placeholder"
  }
] as const;

export default function RiderHomePage() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="badge">Rider shell</p>
        <h1>Ride booking starts here.</h1>
        <p>
          This workspace is a clean starter for the rider experience and will be expanded in Phase 2.
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
