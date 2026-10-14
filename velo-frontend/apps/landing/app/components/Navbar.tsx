"use client";

import { useEffect, useState } from "react";
import { landingCopy } from "../../content/site";

type Theme = "day" | "night";

export function Navbar({ home = true }: { home?: boolean }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sectionLink = (id: string) => home ? `#${id}` : `/#${id}`;
  const closeMenu = () => setIsMenuOpen(false);
  const [theme, setTheme] = useState<Theme>("night");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "day" ? "day" : "night");
  }, []);
  const toggleTheme = () => {
    const next: Theme = theme === "day" ? "night" : "day";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("velo-theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

  return (
    <header className="site-header">
      <nav className="container nav-inner" aria-label="Primary navigation">
        <a className="wordmark" href="/" aria-label="Velo home" onClick={closeMenu}>
          Velo<span className="wordmark-period" aria-hidden="true">.</span>
        </a>

        <div className={`nav-links${isMenuOpen ? " nav-links-open" : ""}`} id="site-navigation">
          <a href={sectionLink("how-it-works")} onClick={closeMenu}>How it works</a>
          <a href={sectionLink("pricing")} onClick={closeMenu}>Pricing</a>
          <a href={sectionLink("faq")} onClick={closeMenu}>FAQ</a>
          <a className="button button-primary nav-mobile-cta" href={sectionLink("book-a-demo")} onClick={closeMenu}>
            {landingCopy.hero.bookDemo}
          </a>
        </div>

        <button
          className="nav-menu-toggle"
          type="button"
          aria-controls="site-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? "Close" : "Menu"}
        </button>

        <button
          className="theme-toggle"
          type="button"
          aria-pressed={theme === "day"}
          aria-label={theme === "day" ? "Switch to night view" : "Switch to day view"}
          onClick={toggleTheme}
        >
          {theme === "day" ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></g></svg>
          )}
        </button>

        <div className="nav-cta">
          <a className="button button-primary" href={sectionLink("book-a-demo")} onClick={closeMenu}>
            {landingCopy.hero.bookDemo}
          </a>
        </div>
      </nav>
    </header>
  );
}
