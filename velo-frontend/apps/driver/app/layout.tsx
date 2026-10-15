import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Barlow_Condensed, Inter } from "next/font/google";
import { getRequestTenantContext } from "@velo/app-core/tenant-server";
import { resolveTenantPrimaryStyle, TenantBrandingProvider } from "@velo/ui/theme";
import { DriverShell } from "./_components/driver-shell";
import "leaflet/dist/leaflet.css";
import "@velo/ui/styles.css";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getRequestTenantContext();
  return {
    title: `${branding.brandName} ${branding.driverLabel}`,
    description: `${branding.driverLabel} workspace for ${branding.brandName}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { tenantSlug, branding } = await getRequestTenantContext();

  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${inter.variable}`}
      style={resolveTenantPrimaryStyle(branding.primaryColor) as CSSProperties}
      data-tenant-slug={tenantSlug}
      data-tenant-brand-name={branding.brandName}
      data-tenant-rider-label={branding.riderLabel}
      data-tenant-driver-label={branding.driverLabel}
      data-tenant-trip-label={branding.tripLabel}
      data-tenant-currency={branding.currency}
    >
      <body>
        <TenantBrandingProvider branding={branding}>
          <DriverShell>{children}</DriverShell>
        </TenantBrandingProvider>
      </body>
    </html>
  );
}
