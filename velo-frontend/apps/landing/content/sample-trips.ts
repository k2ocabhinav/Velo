import { SAMPLE_TRIPS as DISPATCH_TRIPS } from "@velo/ui/landing";

export type SampleTrip = {
  id: string;
  time: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  progress: number;
};

// The timeline shows the sample day as it looks at about 09:20: the dawn airport
// run is done, the hotel-to-office transfer is on the road, the evening return is booked.
const SNAPSHOT: Record<string, { status: string; progress: number }> = {
  "05:40": { status: "Completed", progress: 1 },
  "09:15": { status: "On trip", progress: 0.75 },
  "18:30": { status: "Booked", progress: 0.25 },
};

/** Same trips as the hero illustration (single source in @velo/ui/landing), with a point-in-time status. */
export const SAMPLE_TRIPS: readonly SampleTrip[] = DISPATCH_TRIPS.map((trip) => ({
  id: trip.id,
  time: trip.time,
  pickup: trip.pickup,
  dropoff: trip.dropOff,
  driver: trip.driver,
  status: SNAPSHOT[trip.id]?.status ?? "Booked",
  progress: SNAPSHOT[trip.id]?.progress ?? 0.25,
}));
