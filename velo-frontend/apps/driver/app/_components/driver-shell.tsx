"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { DriverNotificationsNavIndicator } from "../notifications/_components/nav-indicator";

const PUBLIC_ROUTES = ["/login"];

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/rides", label: "Rides" },
  { href: "/earnings", label: "Earnings" },
  { href: "/notifications", label: "Notifications" },
];

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
