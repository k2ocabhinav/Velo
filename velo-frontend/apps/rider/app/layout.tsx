import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import localFont from "next/font/local";
import { getRequestTenantContext } from "@velo/app-core/tenant-server";
import { resolveTenantPrimaryStyle, TenantBrandingProvider } from "@velo/ui/theme";
import { AppShell } from "./_components/app-shell";
import "leaflet/dist/leaflet.css";
import "@velo/ui/styles.css";
import "./globals.css";

const barlowCondensed = localFont({
  src: [
    { path: "../../../packages/ui/src/theme/font-assets/barlow-condensed/BarlowCondensed-800-latin.woff2", weight: "800" },
    { path: "../../../packages/ui/src/theme/font-assets/barlow-condensed/BarlowCondensed-900-latin.woff2", weight: "900" },
  ],
  variable: "--font-display",
  display: "swap",
  declarations: [{ prop: "font-family", value: "'Barlow Condensed'" }],
});

const inter = localFont({
  src: "../../../packages/ui/src/theme/font-assets/inter/Inter-latin-variable.woff2",
  weight: "400 700",
  variable: "--font-body",
  display: "swap",
  declarations: [{ prop: "font-family", value: "Inter" }],
});

const jetBrainsMono = localFont({
  src: "../../../packages/ui/src/theme/font-assets/jetbrains-mono/JetBrainsMono-Regular-latin.woff2",
  weight: "400",
  variable: "--font-mono-local",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getRequestTenantContext();
  return {
    title: `${branding.brandName} ${branding.riderLabel}`,
    description: `${branding.riderLabel} workspace for ${branding.brandName}`,
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
      className={`${barlowCondensed.variable} ${inter.variable} ${jetBrainsMono.variable}`}
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
          <AppShell>{children}</AppShell>
        </TenantBrandingProvider>
      </body>
    </html>
  );
}
