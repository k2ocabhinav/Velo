type TenantBranding = {
  brandName?: string;
  riderLabel?: string;
  driverLabel?: string;
  tripLabel?: string;
  dispatchMode?: "RIDE_HAILING" | "DELIVERY_MERCHANT" | "FLEET_MANAGED";
  riderPortalEnabled?: boolean;
};

function getApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.VELO_API_BASE_URL ??
    "http://localhost:8080";
  return configured.replace(/\/$/, "");
}

async function fetchBranding(): Promise<TenantBranding | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/public/tenant/branding?tenant=default`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TenantBranding;
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const branding = await fetchBranding();
  const tenantBrandName = branding?.brandName?.trim() || "Velo";
  const platformBrand = tenantBrandName.toLowerCase() === "velo" ? "VELO" : `VELO | ${tenantBrandName}`;
  const driverLabel = branding?.driverLabel ?? "Driver";
  const riderLabel = branding?.riderLabel ?? "Requester";
  const tripLabel = branding?.tripLabel ?? "Trip";
  const showRequesterPortal = branding?.riderPortalEnabled ?? true;

  return (
    <main className="wrap">
      <section className="panel">
        <header className="hero">
          <h1>{platformBrand}</h1>
          <p>White-label dispatch infrastructure for rides, shuttles, and delivery operations.</p>
        </header>

        <section className="cta-grid">
          <a className="cta" href="http://localhost:4101" target="_blank" rel="noreferrer">
            <strong>Admin Portal</strong>
            <span>Operations, analytics, dispatch controls, and branding settings.</span>
          </a>

          <a className="cta" href="http://localhost:4103" target="_blank" rel="noreferrer">
            <strong>{driverLabel} Portal</strong>
            <span>Availability, incoming {tripLabel.toLowerCase()} requests, OTP validation, and trip actions.</span>
          </a>

          {showRequesterPortal ? (
            <a className="cta" href="http://localhost:4102" target="_blank" rel="noreferrer">
              <strong>{riderLabel} Portal</strong>
              <span>Map-first booking, fare estimate, promo visibility, and live trip tracking.</span>
            </a>
          ) : (
            <article className="cta">
              <strong>{riderLabel} Portal Disabled</strong>
              <span>Tenant dispatch mode is configured for merchant-admin dispatch.</span>
            </article>
          )}
        </section>

        <p className="meta">
          Port map: Landing 4100 • Admin 4101 • Requester 4102 • Driver 4103
        </p>
      </section>
    </main>
  );
}
