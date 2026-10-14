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

/** Same trip statuses as the hero illustration, shown at about 09:20. */
export const SAMPLE_TRIPS: readonly SampleTrip[] = DISPATCH_TRIPS.map((trip) => ({
  id: trip.id,
  time: trip.time,
  pickup: trip.pickup,
  dropoff: trip.dropOff,
  driver: trip.driver,
  status: trip.status,
  progress: trip.progress,
}));
