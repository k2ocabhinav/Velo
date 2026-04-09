"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "../../../_lib/map/routing";

const DriverRideMapLazy = dynamic(
  () => import("./driver-ride-map").then((mod) => mod.DriverRideMap),
  {
    ssr: false,
    loading: () => (
      <div className="driver-ride-map">
        <div className="driver-ride-map-inner driver-ride-map-placeholder">
          <p className="helper">Loading map...</p>
        </div>
      </div>
    ),
  },
);

type DriverRideMapLoaderProps = {
  pickup: MapPoint | null;
  dropOff: MapPoint | null;
  driver: MapPoint | null;
  routePoints: MapPoint[];
};

export function DriverRideMapLoader(props: DriverRideMapLoaderProps) {
  return <DriverRideMapLazy {...props} />;
}
