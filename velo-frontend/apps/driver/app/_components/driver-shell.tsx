"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppTopBar, BottomNav } from "@velo/ui/composed";
import { FadeIn } from "@velo/ui/motion";
import { DriverNotificationsNavIndicator } from "../notifications/_components/nav-indicator";
import { requestDriverProxy } from "../_lib/driver-client";
import { isPublicDriverRoute } from "../_lib/driver-shell-routes";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/rides", label: "Trips" },
  { href: "/earnings", label: "Earnings" },
  { href: "/me", label: "Me" },
];

type TenantBrandingResponse = {
  brandName?: string;
};

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
  const [tenantBrandName, setTenantBrandName] = useState<string | null>(null);

  useEffect(() => {
    if (isPublicDriverRoute(pathname)) {
      return;
    }

    let cancelled = false;
    void requestDriverProxy<TenantBrandingResponse>("api/v1/tenant/branding")
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setTenantBrandName(typeof payload.brandName === "string" ? payload.brandName : null);
      })
      .catch(() => {
        if (!cancelled) {
          setTenantBrandName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const platformBrand = useMemo(() => {
    const normalized = tenantBrandName?.trim();
    if (!normalized || normalized.toLowerCase() === "velo") {
      return "VELO";
    }
    return `VELO | ${normalized}`;
  }, [tenantBrandName]);

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
        brand={<Link href="/" className="driver-wordmark">{platformBrand}</Link>}
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
        items={NAV_ITEMS.map((item) => ({ ...item, icon: item.label === "Home" ? "⌂" : item.label === "Trips" ? "↗" : item.label === "Earnings" ? "$" : "●" }))}
      />
    </div>
  );
}
