"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationsNavIndicator } from "../notifications/_components/nav-indicator";

const PUBLIC_ROUTES = ["/login", "/register"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell stack">
      <header className="card">
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="actions">
            <Link href="/">Book</Link>
            <Link href="/rides">Rides</Link>
            <Link href="/scheduled">Scheduled</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/promos">Promos</Link>
            <Link href="/notifications">Notifications</Link>
          </div>
          <NotificationsNavIndicator />
        </div>
      </header>
      {children}
    </div>
  );
}
