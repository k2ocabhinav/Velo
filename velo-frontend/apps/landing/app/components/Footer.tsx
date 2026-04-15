import { ScrollReveal } from "./ScrollReveal";

export function Footer({ brandName }: { brandName: string }) {
  const displayName = brandName === "Velo" ? "VELO" : brandName.toUpperCase();

  return (
    <footer className="section-dark section">
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
            READY TO LAUNCH?
          </h2>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-section)" }}>
            <a href="mailto:hello@velo.dev" className="pill-button" style={{ fontSize: "1.125rem", padding: "1rem 2.5rem" }}>
              Request a Demo
            </a>
          </div>
        </ScrollReveal>

        <hr className="thin-rule thin-rule-dark" />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            paddingTop: "1.5rem",
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display), "Barlow Condensed", system-ui, sans-serif',
              fontWeight: 900,
              fontSize: "1.25rem",
              letterSpacing: "-0.02em",
            }}
          >
            {displayName}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", fontSize: "0.8125rem" }}>
            <a href="http://localhost:4101" className="text-muted" style={{ transition: "color 0.2s" }}>
              Admin
            </a>
            <a href="http://localhost:4102" className="text-muted" style={{ transition: "color 0.2s" }}>
              Rider
            </a>
            <a href="http://localhost:4103" className="text-muted" style={{ transition: "color 0.2s" }}>
              Driver
            </a>
            <span className="text-muted">
              &copy; {new Date().getFullYear()} {displayName}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
