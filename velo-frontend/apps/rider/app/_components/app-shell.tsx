"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppTopBar, BottomNav } from "@velo/ui";
import { FadeIn } from "@velo/ui/motion";
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
    <div className="rider-shell">
      <AppTopBar
        brand={<Link className="rider-brand" href="/" aria-label="Velo home">VELO</Link>}
        actions={<NotificationsNavIndicator />}
      />
      <BottomNav
        currentPath={pathname === "/ride/active" || pathname === "/scheduled" ? "/rides" : pathname === "/promos" ? "/account" : pathname}
        items={[
          { href: "/", label: "Book", icon: "⌖" },
          { href: "/rides", label: "Trips", icon: "↗" },
          { href: "/wallet", label: "Wallet", icon: "◈" },
          { href: "/account", label: "Me", icon: "●" },
        ]}
      />
      <div className="rider-content">
        <FadeIn key={pathname}>{children}</FadeIn>
      </div>
    </div>
  );
}
