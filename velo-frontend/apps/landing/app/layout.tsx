import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "@velo/ui/tokens.css";
import "./globals.css";
import "./theme.css";

const barlowCondensed = localFont({
  src: "../../../packages/ui/src/theme/font-assets/barlow-condensed/BarlowCondensed-800-latin.woff2",
  weight: "800",
  variable: "--font-display",
  display: "swap",
  declarations: [{ prop: "font-family", value: "'Barlow Condensed'" }],
});

const inter = localFont({
  src: "../../../packages/ui/src/theme/font-assets/inter/Inter-latin-variable.woff2",
  weight: "400 600",
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

const siteTitle = "Velo | Dispatch desk for transfer fleets";
const siteDescription =
  "A dispatch desk for fleets of 10 to 50 vehicles running pre-booked business and hotel transfers, anywhere.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://velo.app";

const THEME_SCRIPT = `try{var t=localStorage.getItem("velo-theme");if(t!=="day"&&t!=="night"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"day":"night"}document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Velo",
  },
  description: siteDescription,
  alternates: { canonical: "/" },
  applicationName: "Velo",
  openGraph: {
    type: "website",
    siteName: "Velo",
    url: siteUrl,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Velo dispatch desk for pre-booked business and hotel transfers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${inter.variable} ${jetBrainsMono.variable}`} data-theme="day" suppressHydrationWarning>
      <head>
        <script
          // Runs before paint so the hero never flashes the wrong time of day.
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
