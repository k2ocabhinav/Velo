"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppTopBar, BottomNav } from "@velo/ui/composed";
import { useTenantBranding } from "@velo/ui/theme";
import { getTenantWordmark } from "@velo/app-core/tenant";
import { FadeIn } from "@velo/ui/motion";
import { DriverNotificationsNavIndicator } from "../notifications/_components/nav-indicator";
import { isPublicDriverRoute } from "../_lib/driver-shell-routes";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" as const },
  { href: "/rides", label: "Trips", icon: "trips" as const },
  { href: "/earnings", label: "Earnings", icon: "earnings" as const },
  { href: "/me", label: "Me", icon: "account" as const },
];

function isActiveRidePage(pathname: string): boolean {
  return /^\/ride\/[^/]+$/.test(pathname);
}

function getPageTitle(pathname: string): string {
  if (isActiveRidePage(pathname)) return "Trip";
  if (pathname === "/rides" || pathname.startsWith("/rides/")) return "Trips";
  if (pathname === "/earnings") return "Earnings";
  if (pathname === "/notifications") return "Notifications";
  if (pathname === "/me") return "Me";
  return "Home";
}

export function DriverShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() ?? "/";
  const { brandName } = useTenantBranding();
  const wordmark = getTenantWordmark(brandName);

  if (isPublicDriverRoute(pathname)) {
    return <>{children}</>;
  }

  // No Framer Motion on active ride page for low-end device performance (DESIGN_SYSTEM.md)
  const content = isActiveRidePage(pathname) ? children : <FadeIn key={pathname}>{children}</FadeIn>;

  const currentPath = isActiveRidePage(pathname) ? "/" : pathname;

  return (
    <div className="driver-shell">
      <AppTopBar
        className="driver-topbar"
        brand={<Link href="/" className="driver-wordmark" title={wordmark}>{wordmark}</Link>}
        title={getPageTitle(pathname)}
        actions={(
          <>
            <nav className="driver-desktop-nav" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} aria-current={currentPath === item.href ? "page" : undefined}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <DriverNotificationsNavIndicator />
          </>
        )}
      />
      <div className="driver-main">{content}</div>
      <BottomNav
        className="driver-bottom-nav"
        currentPath={currentPath}
        items={NAV_ITEMS}
      />
    </div>
  );
}
