"use client";

import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#tagline", label: "Platform" },
  { href: "#verticals", label: "Verticals" },
  { href: "#how-it-works", label: "How It Works" },
];

export function Navbar({ brandName }: { brandName: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "0 clamp(1.5rem, 3vw, 4rem)",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: scrolled ? "rgba(19,19,19,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "background 0.3s, backdrop-filter 0.3s, border-color 0.3s",
      }}
    >
      <a
        href="#"
        style={{
          fontFamily: 'var(--font-display), "Barlow Condensed", system-ui, sans-serif',
          fontWeight: 900,
          fontSize: "1.75rem",
          letterSpacing: "-0.02em",
          textTransform: "uppercase" as const,
        }}
      >
        {brandName === "Velo" ? "VELO" : brandName.toUpperCase()}
      </a>

      {/* Desktop nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2rem",
        }}
        className="nav-desktop"
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--velo-gray-mid)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--velo-white)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--velo-gray-mid)")}
          >
            {link.label}
          </a>
        ))}
        <a href="mailto:hello@velo.dev" className="pill-button" style={{ padding: "0.625rem 1.5rem", fontSize: "0.875rem" }}>
          Request Demo
        </a>
      </div>

      {/* Mobile hamburger */}
      <button
        type="button"
        className="nav-hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        style={{
          display: "none",
          background: "none",
          border: "none",
          color: "var(--velo-white)",
          fontSize: "1.5rem",
        }}
      >
        {menuOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(19,19,19,0.98)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2rem",
            zIndex: 49,
          }}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{ fontSize: "1.25rem", fontWeight: 600 }}
            >
              {link.label}
            </a>
          ))}
          <a href="mailto:hello@velo.dev" className="pill-button" onClick={() => setMenuOpen(false)}>
            Request Demo
          </a>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
