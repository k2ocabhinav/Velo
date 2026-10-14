export function Pricing() {
  return (
    <section className="section section-light pricing-section" id="pricing" aria-labelledby="pricing-title">
      <div className="container pricing-inner">
        <div>
          <p className="section-kicker">Pricing hypothesis</p>
          <h2 className="section-heading" id="pricing-title">A simple monthly price per vehicle.</h2>
          <p className="section-copy">Start with one plan for small transfer fleets. We’ll confirm fit and terms during early access.</p>
        </div>
        <div className="price-card">
          <p className="price-label">Proposed starter</p>
          <p className="price"><span>₹</span>499 <small>/ vehicle / month</small></p>
          <p className="price-note">Early-access pricing — subject to change</p>
          <a className="button button-dark" href="#contact">Discuss early access <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  );
}
