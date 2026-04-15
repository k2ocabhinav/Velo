"use client";

import { ScrollReveal } from "./ScrollReveal";

const PILLARS = [
  {
    title: "Your Brand, Everywhere",
    description: "White-label every touchpoint. Your riders, drivers, and ops team see your name, your colors, your logo.",
  },
  {
    title: "Configure, Don't Code",
    description: "Matching strategies, fare models, dispatch modes, and payment flows are all config. No fork required.",
  },
  {
    title: "Scale Without Fear",
    description: "Multi-tenant from day one. WebSocket-driven real-time. Built for thousands of concurrent rides.",
  },
];

export function TaglineBar() {
  return (
    <section id="tagline" className="section-light section">
      <div className="container">
        <ScrollReveal>
          <h2
            className="section-heading"
            style={{
              fontSize: "var(--text-heading-lg)",
              textAlign: "center",
              marginBottom: "var(--space-block)",
            }}
          >
            The engine behind every ride.
          </h2>
        </ScrollReveal>

        <hr className="thin-rule" />

        <div className="grid-3col" style={{ marginTop: "var(--space-block)" }}>
          {PILLARS.map((pillar, i) => (
            <ScrollReveal key={pillar.title} delay={i * 0.1}>
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display), "Barlow Condensed", system-ui, sans-serif',
                    fontWeight: 800,
                    fontSize: "var(--text-heading-sm)",
                    textTransform: "uppercase",
                    marginBottom: "0.75rem",
                    lineHeight: 1,
                  }}
                >
                  {pillar.title}
                </h3>
                <p className="text-muted-light" style={{ lineHeight: 1.6 }}>
                  {pillar.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
