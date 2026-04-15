const TEXT =
  "YOUR FLEET \u00B7 YOUR BRAND \u00B7 YOUR RULES \u00B7 BUILT ON VELO \u00B7 VELOCITY, SIMPLIFIED \u00B7 ";

export function Marquee() {
  return (
    <section
      className="section-dark"
      style={{
        overflow: "hidden",
        padding: "clamp(2rem, 3vw, 4rem) 0",
        borderTop: "1px solid var(--velo-border-dark)",
        borderBottom: "1px solid var(--velo-border-dark)",
      }}
    >
      <div className="marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <span
            key={copy}
            style={{
              fontFamily: 'var(--font-display), "Barlow Condensed", system-ui, sans-serif',
              fontWeight: 900,
              fontSize: "clamp(3rem, 2rem + 5vw, 7rem)",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              paddingRight: "2rem",
              opacity: 0.15,
            }}
          >
            {TEXT}
          </span>
        ))}
      </div>
    </section>
  );
}
