const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev";

export function Footer({ home = true }: { home?: boolean }) {
  const link = (hash: string) => home ? hash : `/${hash}`;
  return (
    <footer className="site-footer section-dark">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand-block">
            <a className="wordmark" href="/" aria-label="Velo home">Velo<span className="wordmark-period">.</span></a>
            <p>A branded dispatch desk for pre-booked transfers.</p>
            <p className="built-in-india">Built in India</p>
          </div>
          <div className="footer-links-group">
            <span className="footer-label">Product</span>
            <a href={link("#product")}>Dispatch and tracking</a>
            <a href={link("#how-it-works")}>How it works</a>
            <a href={link("#pricing")}>Pricing</a>
          </div>
          <div className="footer-links-group">
            <span className="footer-label">Contact</span>
            <a href={link("#contact")}>Book a demo</a>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </div>
          <div className="footer-links-group">
            <span className="footer-label">Policies</span>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Velo</span>
          <span>Pre-launch</span>
        </div>
      </div>
    </footer>
  );
}
