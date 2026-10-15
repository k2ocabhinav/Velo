"use client";

import Link from "next/link";
import { useState } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import { Button, PageHeader, Section } from "@velo/ui";
import { DarkModeToggle, useTenantBrandingOrDefault } from "@velo/ui/theme";

export default function RiderAccountPage() {
  const words = getTenantLabelWords(useTenantBrandingOrDefault());
  const [loggingOut, setLoggingOut] = useState(false);

  async function signOut(): Promise<void> {
    setLoggingOut(true);
    try {
      await performClientLogout({ logoutPath: "/api/auth/logout", loginPath: "/login" });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="app-shell rider-page stack">
      <PageHeader title="Account" description={`Manage your preferences and saved ${words.tripWord} options.`} />

      <Section title="Your shortcuts">
        <div className="account-link-list">
          <Link className="account-link-row" href="/promos">
            <span><strong>Offers</strong><small>{`Find a code for your next ${words.tripWord}`}</small></span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="account-link-row" href="/scheduled">
            <span><strong>{`Scheduled ${words.tripsWord}`}</strong><small>{`Plan or update a future ${words.tripWord}`}</small></span>
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="account-preference-row">
          <div><strong>Theme</strong><p className="helper">Choose light or dark mode for this device.</p></div>
          <DarkModeToggle className="account-theme-toggle" />
        </div>
      </Section>

      <Section title="Session">
        <p className="helper">Sign out of this device.</p>
        <Button variant="secondary" loading={loggingOut} onClick={() => void signOut()}>
          Sign out
        </Button>
      </Section>
    </main>
  );
}
