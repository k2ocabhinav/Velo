"use client";

import { useState } from "react";

export function Navbar({ home = true }: { home?: boolean }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sectionLink = (id: string) => home ? `#${id}` : `/#${id}`;
  const closeMenu = () => setIsMenuOpen(false);

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

        <div className="nav-cta">
          <a className="button button-small button-primary" href={sectionLink("contact")} onClick={closeMenu}>
            Book a demo
          </a>
        </div>
      </nav>
    </header>
  );
}
