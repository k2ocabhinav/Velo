import { landingCopy, siteConfig } from "../../content/site";

const contactEmail = siteConfig.contactEmail;

export function Footer({ home = true }: { home?: boolean }) {
  const sectionLink = (id: string) => home ? `#${id}` : `/#${id}`;

  return (
    <footer className="site-footer section-night">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand-block">
            <a className="wordmark" href="/" aria-label="Velo home">
              Velo<span className="wordmark-period" aria-hidden="true">.</span>
            </a>
            <p>A dispatch desk for business and hotel transfers.</p>
            <p className="built-in-india">Built in India</p>
          </div>

          <nav className="footer-links-group" aria-label="Product links">
            <span className="footer-label">Explore</span>
            <a href={sectionLink("how-it-works")}>How it works</a>
            <a href={sectionLink("pricing")}>Pricing</a>
            <a href={sectionLink("faq")}>FAQ</a>
          </nav>

          {siteConfig.demoContactAvailable && (
            <div className="footer-links-group">
              <span className="footer-label">Contact</span>
              <a href={sectionLink("book-a-demo")}>{landingCopy.hero.bookDemo}</a>
              {contactEmail && <a href={`mailto:${contactEmail}`}>{contactEmail}</a>}
            </div>
          )}

          <nav className="footer-links-group" aria-label="Legal links">
            <span className="footer-label">Policies</span>
            <a href="/privacy/">Privacy</a>
            <a href="/terms/">Terms</a>
          </nav>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Velo</span>
          <span>Pre-launch. Working demo available.</span>
        </div>
      </div>
    </footer>
  );
}
