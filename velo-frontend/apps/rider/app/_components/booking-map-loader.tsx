"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "../_lib/map/routing";
import type { SelectionTarget } from "../_lib/booking-map-state";

const BookingMapLazy = dynamic(
  () => import("./booking-map").then((mod) => mod.BookingMap),
  {
    ssr: false,
    loading: () => (
      <div className="booking-map">
        <div className="booking-map-inner booking-map-placeholder">
          <p className="helper">Loading map...</p>
        </div>
      </div>
    ),
  },
);

type BookingMapLoaderProps = {
  pickup: MapPoint | null;
  dropOff: MapPoint | null;
  routePoints: MapPoint[];
  activeTarget: SelectionTarget;
  onPointSelected: (target: SelectionTarget, point: MapPoint) => void;
};

export function BookingMapLoader(props: BookingMapLoaderProps) {
  return <BookingMapLazy {...props} />;
}
