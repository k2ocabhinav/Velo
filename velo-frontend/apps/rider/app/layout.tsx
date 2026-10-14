import type { Metadata } from "next";
import { headers } from "next/headers";
import type { CSSProperties, ReactNode } from "react";
import { Barlow_Condensed, Inter } from "next/font/google";
import { DEFAULT_TENANT_BRANDING, fetchTenantBranding, getDefaultTenantSlug, TENANT_SLUG_HEADER } from "@velo/app-core/tenant";
import { resolveTenantPrimaryStyle, TenantBrandingProvider } from "@velo/ui/theme";
import { AppShell } from "./_components/app-shell";
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

export const metadata: Metadata = {
  title: "Velo Rider",
  description: "Rider workspace shell for Velo",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const requestHeaders = await headers();
  const tenantSlug = requestHeaders.get(TENANT_SLUG_HEADER) ?? getDefaultTenantSlug();
  const branding = await fetchTenantBranding(tenantSlug) ?? DEFAULT_TENANT_BRANDING;

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
    >
      <body>
        <TenantBrandingProvider branding={branding}>
          <AppShell>{children}</AppShell>
        </TenantBrandingProvider>
      </body>
    </html>
  );
}
