"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { DarkModeToggle } from "@velo/ui/theme";
import { FadeIn } from "@velo/ui/motion";
import { DriverNotificationsNavIndicator } from "../notifications/_components/nav-indicator";
import { requestDriverProxy } from "../_lib/driver-client";
import { isPublicDriverRoute } from "../_lib/driver-shell-routes";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/rides", label: "Rides" },
  { href: "/earnings", label: "Earnings" },
  { href: "/notifications", label: "Notifications" },
];

type TenantBrandingResponse = {
  brandName?: string;
};

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActiveRidePage(pathname: string): boolean {
  return /^\/ride\/[^/]+$/.test(pathname);
}

export function DriverShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() ?? "/";
  const [loggingOut, setLoggingOut] = useState(false);
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

  async function handleLogout() {
    setLoggingOut(true);
    await performClientLogout({
      logoutPath: "/api/auth/logout",
      loginPath: "/login",
    });
    setLoggingOut(false);
  }

  if (isPublicDriverRoute(pathname)) {
    return <>{children}</>;
  }

  // No Framer Motion on active ride page for low-end device performance (DESIGN_SYSTEM.md)
  const content = isActiveRidePage(pathname) ? children : <FadeIn key={pathname}>{children}</FadeIn>;

  return (
    <div className="app-shell stack">
      <header className="card app-nav">
        <div className="portal-nav">
          <div className="portal-nav-links">
            <strong className="portal-brand">{platformBrand}</strong>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={isActiveRoute(pathname, item.href) ? "true" : "false"}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="portal-nav-actions">
            <DriverNotificationsNavIndicator />
            <DarkModeToggle />
            <button
              className="secondary-button"
              type="button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>
      {content}
    </div>
  );
}
