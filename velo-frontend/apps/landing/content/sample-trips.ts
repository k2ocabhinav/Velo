export type SampleTrip = {
  id: string;
  time: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  progress: number;
};

// TODO(lp-3d): Replace this local copy with SAMPLE_TRIPS from @velo/ui/landing at integration.
export const SAMPLE_TRIPS: readonly SampleTrip[] = [
  { id: "airport", time: "05:40", pickup: "Grand Hotel", dropoff: "Airport terminal", driver: "Mara Chen", status: "Driver assigned", progress: 0.5 },
  { id: "office", time: "09:15", pickup: "Grand Hotel", dropoff: "Business park", driver: "Jonas Reed", status: "On trip", progress: 0.75 },
  { id: "return", time: "18:30", pickup: "Business park", dropoff: "Grand Hotel", driver: "Ari Morgan", status: "Booked", progress: 0.25 },
];
