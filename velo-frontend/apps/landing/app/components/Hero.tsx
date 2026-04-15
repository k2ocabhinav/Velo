"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { lineRevealContainer, lineRevealItem } from "@velo/ui/motion";

const VERTICALS = ["Hospitals", "Universities", "Couriers", "Ride-Hailing", "Logistics"];
const CYCLE_MS = 2500;

function AbstractGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: "repeat(4, 1fr)",
        gap: 6,
        width: "100%",
        maxWidth: 420,
        aspectRatio: "1",
        opacity: 0.25,
      }}
    >
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: i % 5 === 0 ? "var(--velo-blue)" : "rgba(255,255,255,0.08)",
            borderRadius: 4,
            animation: `pulse-grid ${2 + (i % 3)}s ease-in-out ${(i * 0.2)}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse-grid {
          from { opacity: 0.3; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function Hero({ brandName }: { brandName: string }) {
  const [activeVertical, setActiveVertical] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVertical((prev) => (prev + 1) % VERTICALS.length);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="section-dark"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        paddingTop: 80,
        paddingBottom: "var(--space-section)",
      }}
    >
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem", alignItems: "center" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: "clamp(2rem, 4vw, 6rem)",
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* Left column */}
          <div>
            <motion.div
              variants={lineRevealContainer}
              initial="hidden"
              animate="visible"
              style={{ marginBottom: "clamp(1.5rem, 3vw, 3rem)" }}
            >
              {["YOUR FLEET.", `YOUR BRAND.`, "ZERO BACKEND."].map((line, i) => (
                <div key={i} style={{ overflow: "hidden" }}>
                  <motion.div variants={lineRevealItem}>
                    <span
                      className="hero-heading"
                      style={{ display: "block" }}
                    >
                      {i === 1 ? (
                        <>YOUR <span className="accent-text">BRAND</span>.</>
                      ) : (
                        line
                      )}
                    </span>
                  </motion.div>
                </div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-muted"
              style={{
                fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.25rem)",
                maxWidth: "48ch",
                lineHeight: 1.6,
                marginBottom: "clamp(1.5rem, 2vw, 2.5rem)",
              }}
            >
              {brandName} is the dispatch infrastructure that powers your mobility product.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
            >
              <a href="mailto:hello@velo.dev" className="pill-button">
                Request a Demo <span aria-hidden="true">&rarr;</span>
              </a>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                <span className="text-muted">Trusted for:</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeVertical}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    style={{ color: "var(--velo-white)", fontWeight: 600 }}
                  >
                    {VERTICALS[activeVertical]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Right column — abstract placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AbstractGrid />
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-grid > div:last-child {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
