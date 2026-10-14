"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppTopBar, BottomNav } from "@velo/ui";
import { useTenantBranding } from "@velo/ui/theme";
import { getTenantWordmark } from "@velo/app-core/tenant";
import { FadeIn } from "@velo/ui/motion";
import { NotificationsNavIndicator } from "../notifications/_components/nav-indicator";

const PUBLIC_ROUTES = ["/login", "/register"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { brandName } = useTenantBranding();
  const wordmark = getTenantWordmark(brandName);

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="rider-shell">
      <AppTopBar
        brand={<Link className="rider-brand" href="/" aria-label={`${wordmark} home`} title={wordmark}>{wordmark}</Link>}
        actions={<NotificationsNavIndicator />}
      />
      <BottomNav
        currentPath={pathname === "/ride/active" || pathname === "/scheduled" ? "/rides" : pathname === "/promos" ? "/account" : pathname}
        items={[
          { href: "/", label: "Book", icon: "book" },
          { href: "/rides", label: "Trips", icon: "trips" },
          { href: "/wallet", label: "Wallet", icon: "wallet" },
          { href: "/account", label: "Me", icon: "account" },
        ]}
      />
      <div className={pathname === "/" ? "rider-content rider-content-booking" : "rider-content"}>
        <FadeIn key={pathname}>{children}</FadeIn>
      </div>
    </div>
  );
}
