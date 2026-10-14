"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { Menu } from "@velo/ui";
import { useDarkMode, useTenantBranding } from "@velo/ui/theme";
import { FadeIn } from "@velo/ui/motion";
import { getTenantWordmark } from "@velo/app-core/tenant";
import { adminClient } from "../_lib/admin-client";

const NAV_GROUPS = [
  {
    label: "Operate",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/dispatch", label: "Dispatch" },
      { href: "/scheduled-rides", label: "Scheduled rides" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/drivers", label: "Drivers", countKey: "drivers" as const },
      { href: "/users", label: "Users" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/payouts", label: "Payouts", countKey: "payouts" as const },
      { href: "/revenue", label: "Revenue" },
      { href: "/promo-codes", label: "Promo codes", countKey: "promos" as const },
    ],
  },
  {
    label: "Setup",
    items: [{ href: "/branding", label: "Branding" }],
  },
] as const;

type CountKey = "drivers" | "payouts" | "promos";
type NavCounts = Record<CountKey, number>;

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [counts, setCounts] = useState<NavCounts>({ drivers: 0, payouts: 0, promos: 0 });
  const { isDark, toggle } = useDarkMode();
  const { brandName } = useTenantBranding();

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      adminClient.getDriversByStatus("PENDING", 0, 1),
      adminClient.getPendingPayouts(0, 1),
      adminClient.getPromoCodes(),
    ]).then(([drivers, payouts, promos]) => {
      if (cancelled) return;
      setCounts({
        drivers: drivers.status === "fulfilled" ? drivers.value.totalElements : 0,
        payouts: payouts.status === "fulfilled" ? payouts.value.totalElements : 0,
        promos: promos.status === "fulfilled" ? promos.value.filter((promo) => !promo.active).length : 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const wordmark = getTenantWordmark(brandName);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    await performClientLogout({ logoutPath: "/api/auth/logout", loginPath: "/login" });
    setLoggingOut(false);
  }

  const accountItems = [
    {
      label: isDark ? "Switch to light mode" : "Switch to dark mode",
      onSelect: toggle,
    },
    {
      label: loggingOut ? "Signing out…" : "Sign out",
      disabled: loggingOut,
      onSelect: () => void handleLogout(),
    },
  ];

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-sticky">
            <Link className="admin-brand" href="/" aria-label={`${wordmark} admin workspace`}>
              <strong title={wordmark}>{wordmark}</strong>
              <span>Admin workspace</span>
            </Link>
            <nav className="admin-nav" aria-label="Primary">
              {NAV_GROUPS.map((group) => (
                <div className="admin-nav-group" key={group.label}>
                  <h2>{group.label}</h2>
                  {group.items.map((item) => {
                    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    const count = "countKey" in item ? counts[item.countKey] : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-active={active ? "true" : "false"}
                        aria-current={active ? "page" : undefined}
                      >
                        <span>{item.label}</span>
                        {count > 0 ? <span className="admin-nav-count" aria-label={`${count} needs attention`}>{count}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="admin-account">
              <span>Account</span>
              <Menu items={accountItems} triggerLabel="Account menu" ariaLabel="Account actions" />
            </div>
          </div>
        </aside>
        <div className="admin-main">
          <main className="admin-content">
            <FadeIn key={pathname}>{children}</FadeIn>
          </main>
        </div>
      </div>
    </div>
  );
}
