"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ScrollReveal } from "./ScrollReveal";

const STEPS = [
  {
    number: "01",
    title: "Sign Up",
    description: "Create your tenant account. Get API keys and access to the admin dashboard in minutes.",
  },
  {
    number: "02",
    title: "Configure Fleet",
    description: "Set your dispatch mode, fare model, matching strategy, and payment flows — all through config.",
  },
  {
    number: "03",
    title: "Brand Your App",
    description: "Upload your logo, set colors and fonts. Riders and drivers see your brand, not ours.",
  },
  {
    number: "04",
    title: "Go Live",
    description: "Deploy rider and driver apps. Start dispatching rides. Scale from 10 to 10,000 without re-architecture.",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.8", "end 0.5"],
  });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" ref={sectionRef} className="section-light section">
      <div className="container">
        <ScrollReveal>
          <h2
            className="section-heading"
            style={{
              fontSize: "var(--text-heading-md)",
              marginBottom: "var(--space-block)",
              maxWidth: "20ch",
            }}
          >
            From sign-up to dispatching rides in 72 hours.
          </h2>
        </ScrollReveal>

        {/* Progress line */}
        <div style={{ position: "relative", marginBottom: "var(--space-block)" }}>
          <div
            style={{
              height: 2,
              background: "var(--velo-border-light)",
              borderRadius: 1,
            }}
          />
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: 2,
              background: "var(--velo-blue)",
              borderRadius: 1,
              width: "100%",
              scaleX,
              transformOrigin: "left",
            }}
          />
        </div>

        <div className="grid-4col">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 0.1}>
              <div>
                <span
                  className="accent-text"
                  style={{
                    fontFamily: 'var(--font-display), "Barlow Condensed"',
                    fontWeight: 800,
                    fontSize: "2.5rem",
                    display: "block",
                    marginBottom: "0.5rem",
                    lineHeight: 1,
                  }}
                >
                  {step.number}
                </span>
                <h3
                  style={{
                    fontFamily: 'var(--font-display), "Barlow Condensed"',
                    fontWeight: 800,
                    fontSize: "1.25rem",
                    textTransform: "uppercase",
                    marginBottom: "0.5rem",
                  }}
                >
                  {step.title}
                </h3>
                <p className="text-muted-light" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
