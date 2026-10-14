import { ScrollReveal } from "./ScrollReveal";

const friction = [
  { title: "Jobs spread across chats", detail: "A booking lands in a spreadsheet, then details move through WhatsApp threads and calls." },
  { title: "Pickups are easy to miss", detail: "Without one dispatch view, a changed time or unassigned driver can slip past the team." },
  { title: "The customer sees no operator brand", detail: "Riders and drivers rely on generic tools instead of a consistent experience from your business." },
];

const capabilities = [
  { title: "Your name across the service", detail: "Branded rider, driver and admin portals with tenant-level logo and colour settings." },
  { title: "Scheduled jobs in one queue", detail: "Create trips ahead of time and review upcoming bookings from the admin portal." },
  { title: "A dispatch record", detail: "Assign and manage jobs from the dispatch console, with an audit trail of dispatch activity." },
  { title: "Trip status as it changes", detail: "Follow active trips with live driver location and rider-facing tracking." },
  { title: "One setup per operator", detail: "Multi-tenant branding keeps each fleet’s identity and operating data in its own workspace." },
  { title: "Driver earnings and payouts", detail: "Review driver earnings and manage payout requests from the admin portal." },
];

export function ProblemSolution() {
  return (
    <section className="section section-light" id="product" aria-labelledby="product-title">
      <div className="container">
        <ScrollReveal>
          <div className="section-intro">
            <p className="section-kicker">The operating gap</p>
            <h2 className="section-heading" id="product-title">A transfer needs more than a message thread.</h2>
            <p className="section-copy">For a 10–50 vehicle fleet, every pre-booked pickup passes through people, vehicles, timings and customer updates. Velo brings that work into one branded dispatch flow.</p>
          </div>
        </ScrollReveal>

        <div className="friction-grid">
          {friction.map((item, index) => (
            <ScrollReveal key={item.title} delay={index * 0.06}>
              <article className="friction-item">
                <span className="item-index" aria-hidden="true">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <div className="capability-heading">
          <div>
            <p className="section-kicker">How Velo helps</p>
            <h3 className="subsection-heading">From booking to payout, in one place.</h3>
          </div>
          <p className="capability-intro">Use the tools already in the product to plan work ahead, coordinate drivers and keep riders informed.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((item, index) => (
            <article className="capability-item" key={item.title}>
              <span className="capability-marker" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div><h4>{item.title}</h4><p>{item.detail}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
