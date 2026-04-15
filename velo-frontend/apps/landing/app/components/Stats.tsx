"use client";

import { ScrollReveal } from "./ScrollReveal";
import { AnimatedCounter } from "./AnimatedCounter";

const STATS = [
  { value: 197, suffix: "+", label: "Backend tests passing" },
  { value: 5, suffix: "", label: "Dispatch strategies" },
  { value: 100, suffix: "%", label: "Rides tracked in real-time" },
  { value: 24, suffix: "/7", label: "WebSocket connectivity" },
];

export function Stats() {
  return (
    <section className="section-dark section">
      <div className="container">
        <div className="grid-4col">
          {STATS.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.1}>
              <div style={{ textAlign: "center" }}>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                <p
                  className="text-muted"
                  style={{ marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.4 }}
                >
                  {stat.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
