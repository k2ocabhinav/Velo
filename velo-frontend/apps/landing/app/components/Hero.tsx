export function Hero() {
  return (
    <section className="hero section-dark" id="top">
      <div className="container hero-content">
        <div className="hero-copy">
          <p className="section-kicker">For 10–50 vehicle fleets in India</p>
          <h1 className="hero-heading">A branded dispatch desk for pre-booked transfers.</h1>
          <p className="hero-description">
            Run business and hotel transfers under your own brand. Schedule each job, dispatch it from one desk, and track every trip live.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#contact">Book a demo <span aria-hidden="true">→</span></a>
            <a className="button button-outline" href="#how-it-works">See how it works</a>
          </div>
          <p className="hero-note">Your brand for riders and drivers. One view for dispatch.</p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="route-visual-card">
            <div className="route-visual-top"><span className="route-dot" /> <span>Today’s dispatch</span><span className="route-day">Upcoming</span></div>
            <div className="route-line-row"><span className="route-stop" /><span className="route-line" /><span className="route-stop route-stop-end" /></div>
            <div className="route-places"><span>Hotel pickup</span><span>Business district</span></div>
            <div className="route-visual-divider" />
            <div className="route-job-row"><span className="driver-avatar">D</span><span><strong>Driver assigned</strong><small>Trip status visible to dispatch</small></span><span className="route-live">Live</span></div>
          </div>
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
        </div>
      </div>
      <a className="hero-scroll" href="#problem">A clearer view of every transfer <span aria-hidden="true">↓</span></a>
    </section>
  );
}
