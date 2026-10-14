import { ScrollReveal } from "./ScrollReveal";

export function ProductScreens() {
  return (
    <section className="section section-dark screens-section" aria-labelledby="screens-title">
      <div className="container">
        <ScrollReveal>
          <div className="screens-heading">
            <div>
              <p className="section-kicker">Product screens</p>
              <h2 className="section-heading" id="screens-title">One desk for the day’s transfers.</h2>
            </div>
            <p className="section-copy">A dispatch view for the operations team, and trip status for the rider on the way.</p>
          </div>
        </ScrollReveal>

        <div className="screens-grid">
          <ScrollReveal>
            <figure className="product-figure">
              {/* TODO: Replace this illustrative CSS preview with a current admin dispatch screenshot from docs/images/ when one is available. */}
              <div className="dispatch-preview" role="img" aria-label="Illustrative dispatch console screen showing upcoming transfer jobs">
                <div className="preview-sidebar"><span className="preview-mark">V</span><span className="sidebar-active" /><span /><span /><span /></div>
                <div className="preview-main">
                  <div className="preview-toolbar"><span className="preview-title-line" /><span className="preview-user-mark" /></div>
                  <div className="preview-page-title"><span>Dispatch</span><span className="preview-action">New trip +</span></div>
                  <div className="preview-tabs"><span className="tab-active">Today</span><span>Scheduled</span><span>Completed</span></div>
                  <div className="preview-table-head"><span>Trip</span><span>Pickup</span><span>Driver</span><span>Status</span></div>
                  <div className="preview-table-row"><span><b>Airport transfer</b><small>Hotel pickup</small></span><span>09:30</span><span>Assigned</span><i className="status-pill status-blue">On the way</i></div>
                  <div className="preview-table-row"><span><b>Business transfer</b><small>Office pickup</small></span><span>10:15</span><span>Assigned</span><i className="status-pill">Scheduled</i></div>
                  <div className="preview-table-row"><span><b>Hotel transfer</b><small>Terminal pickup</small></span><span>11:00</span><span>Unassigned</span><i className="status-pill status-amber">Needs driver</i></div>
                </div>
              </div>
              <figcaption><span>01</span><span><strong>Dispatch console</strong><small>Review scheduled jobs and current trip status.</small></span></figcaption>
            </figure>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <figure className="product-figure product-figure-mobile">
              {/* TODO: Replace this illustrative CSS preview with a current rider trip-tracking screenshot from docs/images/ when one is available. */}
              <div className="rider-preview" role="img" aria-label="Illustrative rider screen showing a driver approaching a pickup">
                <div className="phone-frame">
                  <div className="phone-notch" />
                  <div className="phone-top"><span>09:24</span><span>•••</span></div>
                  <div className="phone-brand">Your transfer</div>
                  <div className="map-preview">
                    <div className="map-road map-road-one" /><div className="map-road map-road-two" /><div className="map-road map-road-three" />
                    <div className="map-route" /><span className="map-pin map-pin-start" /><span className="map-pin map-pin-end" /><span className="map-car">●</span>
                  </div>
                  <div className="rider-trip-info"><span className="rider-status-dot" /><span><b>Driver is on the way</b><small>Trip updates appear here</small></span></div>
                  <div className="rider-route-info"><span>Pickup</span><b>Hotel entrance</b><span>Drop-off</span><b>Business district</b></div>
                </div>
              </div>
              <figcaption><span>02</span><span><strong>Rider trip tracking</strong><small>Keep the pickup and trip status visible.</small></span></figcaption>
            </figure>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
