export const TRIP_STATUS_STEPS = [
  "Booked",
  "Driver assigned",
  "On trip",
  "Completed",
] as const;

export type TripStatusStep = (typeof TRIP_STATUS_STEPS)[number];

export type SampleTrip = {
  id: "05:40" | "09:15" | "18:30";
  time: string;
  pickup: string;
  dropOff: string;
  driver: string;
  statusSteps: readonly TripStatusStep[];
  status: TripStatusStep;
  progress: number;
};

const FIRST_TRIP: SampleTrip = {
  id: "05:40",
  time: "05:40",
  pickup: "Airport",
  dropOff: "Grand Hotel",
  driver: "Maya Chen",
  statusSteps: TRIP_STATUS_STEPS,
  status: "Completed",
  progress: 1,
};

export const SAMPLE_TRIPS: readonly SampleTrip[] = [
  FIRST_TRIP,
  {
    id: "09:15",
    time: "09:15",
    pickup: "Grand Hotel",
    dropOff: "Business park",
    driver: "Sofia Duarte",
    statusSteps: TRIP_STATUS_STEPS,
    status: "On trip",
    progress: 0.75,
  },
  {
    id: "18:30",
    time: "18:30",
    pickup: "Business park",
    dropOff: "Airport",
    driver: "Noah Martin",
    statusSteps: TRIP_STATUS_STEPS,
    status: "Booked",
    progress: 0.25,
  },
] as const;

export function getSampleTrip(id: SampleTrip["id"]): SampleTrip {
  return SAMPLE_TRIPS.find((trip) => trip.id === id) ?? FIRST_TRIP;
}
