"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { DarkModeToggle } from "@velo/ui/theme";
import { FadeIn } from "@velo/ui/motion";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/dispatch", label: "Dispatch" },
  { href: "/drivers", label: "Drivers" },
  { href: "/users", label: "Users" },
  { href: "/payouts", label: "Payouts" },
  { href: "/promo-codes", label: "Promo codes" },
  { href: "/branding", label: "Branding" },
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
  const [tenantBrandName, setTenantBrandName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/proxy/api/v1/tenant/branding", {
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        const payload = (await response.json()) as { data?: { brandName?: string }; brandName?: string };
        return payload?.data?.brandName ?? payload?.brandName ?? null;
      })
      .then((brandName) => {
        if (!cancelled) {
          setTenantBrandName(typeof brandName === "string" ? brandName : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTenantBrandName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      loginPath: "/login"
    });
    setLoggingOut(false);
  }

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <strong>{platformBrand}</strong>
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
            <div className="admin-topbar-actions">
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
          </header>
          <main className="admin-content">
            <FadeIn key={pathname}>{children}</FadeIn>
          </main>
        </div>
      </div>
    </div>
  );
}
