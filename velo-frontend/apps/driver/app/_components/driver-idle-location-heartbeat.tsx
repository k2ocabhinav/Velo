"use client";

import { useEffect, useState } from "react";
import { requestDriverProxy, type DriverProfile } from "../_lib/driver-client";
import { useDriverLocationPublisher } from "../_lib/driver-location-publisher";

const PROFILE_REFRESH_INTERVAL_MS = 30_000;

export function DriverIdleLocationHeartbeat() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let disposed = false;

    const refreshAvailability = async () => {
      try {
        const profile = await requestDriverProxy<DriverProfile>("drivers/getMyProfile");
        if (!disposed) {
          setOnline(profile.available === true);
        }
      } catch {
        // Keep the last known availability during temporary API failures.
      }
    };

    void refreshAvailability();
    const intervalId = window.setInterval(() => void refreshAvailability(), PROFILE_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useDriverLocationPublisher(null, online);
  return null;
}
