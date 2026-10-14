import { ScrollReveal } from "./ScrollReveal";

const steps = [
  { number: "01", title: "Set up your brand", description: "Add your operator name, logo and primary colour. Invite the team who handles bookings and dispatch." },
  { number: "02", title: "Put jobs on the schedule", description: "Create trips ahead of time, then review upcoming bookings in the scheduled trips view." },
  { number: "03", title: "Dispatch and follow each trip", description: "Work from the dispatch console, see live trip progress, and review driver earnings and payout requests." },
];

export function HowItWorks() {
  return (
    <section className="section section-light how-section" id="how-it-works" aria-labelledby="how-title">
      <div className="container">
        <ScrollReveal>
          <div className="section-intro section-intro-wide">
            <p className="section-kicker">How it works</p>
            <h2 className="section-heading" id="how-title">Three steps from setup to dispatch.</h2>
          </div>
        </ScrollReveal>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <ScrollReveal key={step.number} delay={index * 0.08}>
              <article className="step-item">
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
