"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { DriverNotificationsNavIndicator } from "../notifications/_components/nav-indicator";
import { requestDriverProxy } from "../_lib/driver-client";

const PUBLIC_ROUTES = ["/login"];

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/rides", label: "Rides" },
  { href: "/earnings", label: "Earnings" },
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

export function DriverShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() ?? "/";
  const [loggingOut, setLoggingOut] = useState(false);
  const [tenantBrandName, setTenantBrandName] = useState<string | null>(null);

  useEffect(() => {
    if (isPublicRoute(pathname)) {
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
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="actions">
            <strong>{platformBrand}</strong>
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
          <div className="actions" style={{ alignItems: "center" }}>
            <DriverNotificationsNavIndicator />
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
      {children}
    </div>
  );
}
