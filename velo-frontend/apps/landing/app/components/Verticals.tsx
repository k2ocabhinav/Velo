"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { accordionContent } from "@velo/ui/motion";
import { ScrollReveal } from "./ScrollReveal";

const VERTICALS = [
  {
    name: "Hospitals & NEMT",
    tagline: "On-time patient transport, every time.",
    description:
      "Schedule recurring trips, enforce HIPAA-ready audit trails, and integrate with discharge planning workflows.",
    capabilities: ["Scheduled & recurring rides", "Priority-based dispatch", "Compliance-ready audit logs", "Insurance billing hooks"],
  },
  {
    name: "Campus & University",
    tagline: "Safe rides for every student, faculty, and visitor.",
    description:
      "Geo-fenced campus zones, shuttle loops, and on-demand point-to-point — all under one branded experience.",
    capabilities: ["Geo-fenced service areas", "Shuttle loop scheduling", "Student ID verification", "Real-time campus map"],
  },
  {
    name: "Courier & Delivery",
    tagline: "Last-mile logistics that scales with demand.",
    description:
      "Multi-stop routing, proof-of-delivery, and merchant dispatch APIs for same-day and on-demand fulfillment.",
    capabilities: ["Multi-stop optimization", "Proof-of-delivery capture", "Merchant API integration", "Real-time package tracking"],
  },
  {
    name: "Ride-Hailing",
    tagline: "Launch your own Uber — without building from scratch.",
    description:
      "Fare estimation, surge pricing, driver matching, and rider apps — all configurable, all white-label.",
    capabilities: ["Surge pricing engine", "Nearest/highest-rated matching", "Promo code management", "Driver earnings & payouts"],
  },
  {
    name: "Any Fleet",
    tagline: "If it moves people or packages, Velo dispatches it.",
    description:
      "The dispatch primitives are generic. Limousines, airport shuttles, corporate fleets, medical transport — configure the mode, ship the product.",
    capabilities: ["Custom dispatch strategies", "Fleet-specific fare models", "Multi-tenant isolation", "Branded rider & driver apps"],
  },
];

export function Verticals() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="verticals" className="section-dark section">
      <div className="container">
        <ScrollReveal>
          <h2
            className="section-heading"
            style={{
              fontSize: "var(--text-heading-md)",
              marginBottom: "0.5rem",
            }}
          >
            Every business is different.
          </h2>
          <h2
            className="section-heading accent-text"
            style={{
              fontSize: "var(--text-heading-md)",
              marginBottom: "var(--space-block)",
            }}
          >
            We power all of them.
          </h2>
        </ScrollReveal>

        <div style={{ display: "grid", gap: 0 }}>
          {VERTICALS.map((v, i) => {
            const isOpen = openIndex === i;
            return (
              <ScrollReveal key={v.name} delay={i * 0.05}>
                <div
                  style={{
                    borderTop: "1px solid var(--velo-border-dark)",
                    ...(i === VERTICALS.length - 1 ? { borderBottom: "1px solid var(--velo-border-dark)" } : {}),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "clamp(1.25rem, 2vw, 2rem) 0",
                      background: "none",
                      border: "none",
                      color: "inherit",
                      textAlign: "left",
                    }}
                    aria-expanded={isOpen}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "clamp(1rem, 2vw, 2rem)" }}>
                      <span className="text-muted" style={{ fontFamily: 'var(--font-display), "Barlow Condensed"', fontWeight: 800, fontSize: "1.25rem", minWidth: "2rem" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-display), "Barlow Condensed"',
                        fontWeight: 800,
                        fontSize: "var(--text-heading-sm)",
                        textTransform: "uppercase",
                        lineHeight: 1,
                      }}>
                        {v.name}
                      </span>
                      <span className="text-muted" style={{ fontSize: "0.875rem" }}>
                        {v.tagline}
                      </span>
                    </div>
                    <span style={{ fontSize: "1.5rem", opacity: 0.6, transition: "transform 0.3s", transform: isOpen ? "rotate(45deg)" : "none" }}>
                      +
                    </span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        variants={accordionContent}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                      >
                        <div style={{ paddingBottom: "clamp(1.25rem, 2vw, 2rem)", paddingLeft: "clamp(3rem, 4vw, 4.5rem)" }}>
                          <p className="text-muted" style={{ maxWidth: "60ch", lineHeight: 1.6, marginBottom: "1rem" }}>
                            {v.description}
                          </p>
                          <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", listStyle: "none", padding: 0 }}>
                            {v.capabilities.map((cap) => (
                              <li key={cap} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                                <span className="accent-text">&#10003;</span> {cap}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
