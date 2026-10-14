export function Navbar({ home = true }: { home?: boolean }) {
  const link = (hash: string) => home ? hash : `/${hash}`;
  return (
    <header className={`site-header${home ? "" : " site-header-light"}`}>
      <nav className="container nav-inner" aria-label="Main navigation">
        <a className="wordmark" href="/" aria-label="Velo home">Velo<span className="wordmark-period">.</span></a>
        <div className="nav-links">
          <a href={link("#product")}>Product</a>
          <a href={link("#how-it-works")}>How it works</a>
          <a href={link("#pricing")}>Pricing</a>
        </div>
        <a className="button button-small button-primary" href={link("#contact")}>Book a demo <span aria-hidden="true">→</span></a>
      </nav>
    </header>
  );
}
