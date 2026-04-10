"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { performClientLogout } from "@velo/app-core/logout";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/dispatch", label: "Dispatch" },
  { href: "/drivers", label: "Drivers" },
  { href: "/users", label: "Users" },
  { href: "/payouts", label: "Payouts" },
  { href: "/promo-codes", label: "Promo codes" },
  { href: "/revenue", label: "Revenue" },
  { href: "/scheduled-rides", label: "Scheduled rides" }
];

export function AdminShell({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await performClientLogout({
      logoutPath: "/api/auth/logout",
      loginPath: "/login"
    });
    setLoggingOut(false);
  }

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <strong>Velo</strong>
            <span>Admin workspace</span>
          </div>
          <nav className="admin-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} data-active={active ? "true" : "false"}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <div>
              <p>Phase 1 control center</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </header>
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
