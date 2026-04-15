import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { TaglineBar } from "./components/TaglineBar";
import { Verticals } from "./components/Verticals";
import { Stats } from "./components/Stats";
import { Marquee } from "./components/Marquee";
import { HowItWorks } from "./components/HowItWorks";
import { Footer } from "./components/Footer";

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
  const brandName = branding?.brandName?.trim() || "Velo";

  return (
    <>
      <Navbar brandName={brandName} />
      <Hero brandName={brandName} />
      <TaglineBar />
      <Verticals />
      <Stats />
      <Marquee />
      <HowItWorks />
      <Footer brandName={brandName} />
    </>
  );
}
