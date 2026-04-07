"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
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
          </header>
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
