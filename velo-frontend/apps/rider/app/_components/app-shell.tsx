"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { DarkModeToggle } from "@velo/ui/theme";
import { FadeIn } from "@velo/ui/motion";
import { NotificationsNavIndicator } from "../notifications/_components/nav-indicator";
import { requestRiderProxy } from "../_lib/rider-client";

const PUBLIC_ROUTES = ["/login", "/register"];
const NAV_ITEMS = [
  { href: "/", label: "Book" },
  { href: "/ride/active", label: "Active Trip" },
  { href: "/rides", label: "Rides" },
  { href: "/scheduled", label: "Scheduled" },
  { href: "/wallet", label: "Wallet" },
  { href: "/promos", label: "Promos" },
  { href: "/notifications", label: "Notifications" },
];

type TenantBrandingResponse = {
  brandName?: string;
};

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [loggingOut, setLoggingOut] = useState(false);
  const [tenantBrandName, setTenantBrandName] = useState<string | null>(null);

  useEffect(() => {
    if (isPublicRoute(pathname)) {
      return;
    }

    let cancelled = false;
    void requestRiderProxy<TenantBrandingResponse>("api/v1/tenant/branding")
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
      sessionStorageKeysToClear: ["velo_ws_token"],
    });
    setLoggingOut(false);
  }

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

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
            <NotificationsNavIndicator />
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
      <FadeIn key={pathname}>{children}</FadeIn>
    </div>
  );
}
