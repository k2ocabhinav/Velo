import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DriverShell } from "./_components/driver-shell";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velo Driver",
  description: "Driver workspace shell for Velo"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DriverShell>{children}</DriverShell>
      </body>
    </html>
  );
}
