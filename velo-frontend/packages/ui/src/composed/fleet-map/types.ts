export type FleetDriverStatus = "AVAILABLE" | "EN_ROUTE_TO_PICKUP" | "ON_TRIP";
export type FleetRideStatus = "REQUESTED" | "CONFIRMED" | "ONGOING";

export interface FleetMapPoint {
  lat: number;
  lng: number;
  address?: string | null;
}

export interface FleetMapDriver {
  driverId: number;
  name: string;
  vehiclePlate: string;
  rating: number;
  status: FleetDriverStatus;
  lat: number;
  lng: number;
  heading?: number | null;
  speedKph?: number | null;
  locationUpdatedAt?: string | null;
  stale: boolean;
  simulated: boolean;
  rideId?: number | null;
}

export interface FleetMapRide {
  rideId: number | null;
  rideRequestId: number;
  status: FleetRideStatus;
  riderName: string;
  driverId?: number | null;
  pickup: FleetMapPoint;
  dropOff: FleetMapPoint;
  requestedAt?: string | null;
  startedAt?: string | null;
  fare?: number | string | null;
  simulated: boolean;
}

export type FleetMapSelection =
  | { type: "driver"; id: number }
  | { type: "ride"; id: number };

export interface FleetMapFocusRequest {
  selection: FleetMapSelection;
  sequence: number;
}
