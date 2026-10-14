"use client";

import { useCallback, useEffect, useState } from "react";
import { performClientLogout } from "@velo/app-core/logout";
import { DefinitionList, EmptyState, ErrorState, PageHeader, Section } from "@velo/ui/composed";
import { Skeleton } from "@velo/ui/feedback";
import { DarkModeToggle } from "@velo/ui/theme";
import { Button } from "@velo/ui/primitives";
import { requestDriverProxy, type DriverProfile } from "../_lib/driver-client";

export default function DriverAccountPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await requestDriverProxy<DriverProfile>("drivers/getMyProfile"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    await performClientLogout({ logoutPath: "/api/auth/logout", loginPath: "/login" });
    setSigningOut(false);
  }

  return (
    <main className="stack">
      <PageHeader title="Your account" description="Manage your driver details and app preferences." />

      <Section title="Your profile">
        {loading ? (
          <div className="stack compact" role="status" aria-label="Loading your profile" aria-busy="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : null}
        {!loading && error ? <ErrorState title="Couldn't load your profile" description={error} onRetry={() => void loadProfile()} /> : null}
        {!loading && !error && !profile ? (
          <EmptyState title="Profile unavailable" description="Try loading your driver profile again." action={<Button variant="secondary" onClick={() => void loadProfile()}>Refresh profile</Button>} />
        ) : null}
        {!loading && !error && profile ? (
          <DefinitionList
            items={[
              { label: "Name", value: profile.user?.name || "Driver" },
              { label: "Email", value: profile.user?.email || "Not provided" },
              { label: "Vehicle", value: profile.vehicleId || "Not provided" },
              { label: "Rating", value: profile.rating === null || profile.rating === undefined ? "Not rated yet" : `${profile.rating.toFixed(1)} / 5` },
              { label: "Availability", value: <span className="badge" data-tone={profile.available ? "success" : "neutral"}>{profile.available ? "Online" : "Offline"}</span> },
            ]}
          />
        ) : null}
      </Section>

      <Section title="Appearance">
        <div className="driver-availability">
          <div className="driver-availability-copy">
            <strong>Theme</strong>
            <p>Choose light or dark mode for this device.</p>
          </div>
          <DarkModeToggle />
        </div>
      </Section>

      <Section title="Account">
        <p className="driver-section-copy">Sign out of this device when you’re finished driving.</p>
        <Button variant="secondary" disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </Section>
    </main>
  );
}
