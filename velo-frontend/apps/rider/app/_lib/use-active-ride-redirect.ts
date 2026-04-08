"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestRiderProxy } from "./rider-client";
import { normalizeRideLifecycleStatus, shouldRedirectToActiveRide } from "./rider-active-ride-state";

type ActiveRideLookup = {
  status?: string | null;
};

export function useActiveRideRedirect(currentPath: string, enabled = true): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function run(): Promise<void> {
      try {
        const activeRide = await requestRiderProxy<ActiveRideLookup | null>("riders/active-ride");
        if (cancelled || !activeRide) {
          return;
        }

        const status = normalizeRideLifecycleStatus(activeRide.status);
        if (shouldRedirectToActiveRide(status) && currentPath !== "/ride/active") {
          router.replace("/ride/active");
        }
      } catch {
        // Keep current page experience unchanged when active-ride lookup fails.
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [currentPath, enabled, router]);
}
