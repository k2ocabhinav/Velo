export type TenantSlug = "default" | "saffron-routes";
export type SimRole = "DRIVER" | "RIDER";
export type DriverState = "offline" | "idle" | "thinking" | "to-pickup" | "waiting-rider" | "on-trip" | "repositioning" | "stopping";
export type ControlDriverState = "offline" | "idle" | "repositioning" | "to-pickup" | "waiting" | "on-trip" | "delayed";
export type RiderState = "idle" | "requested" | "assigned" | "on-trip";

export interface SimAccount {
  key: string;
  displayName: string;
  email: string;
  password: string;
  role: SimRole;
  tenant: TenantSlug;
  vehicleId?: string;
}

export interface SimTenant {
  slug: TenantSlug;
  name: string;
  currency: string;
  simDomain: string;
  drivers: SimAccount[];
  riders: SimAccount[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PointDto {
  type: "Point";
  coordinates: [number, number];
}

export interface DriverLocationUpdate {
  lat: number;
  lng: number;
  heading: number;
  speedKph: number;
  accuracyM: number;
  capturedAt: string;
}

export interface RideRequestPayload {
  pickupLocation: PointDto;
  dropOffLocation: PointDto;
  pickupAddress: string;
  dropOffAddress: string;
  paymentMethod: "WALLET";
}

export interface RideRequestDto {
  id?: number | null;
  rideRequestStatus?: string | null;
  expiresAt?: string | null;
  pickupLocation?: PointDto;
  dropOffLocation?: PointDto;
}

export interface RideDto {
  id: number;
  rideStatus?: string;
}

export interface RideTrackingDto {
  rideId?: number | null;
  rideRequestId?: number | null;
  status?: string | null;
  otp?: string | null;
}

export interface DriverProfileDto {
  id: number;
  user: { name: string; email: string; roles: string[] };
  rating: number;
  available: boolean;
  vehicleId: string;
}

export interface RiderProfileDto {
  id: number;
  user: { name: string; email: string; roles: string[] };
  rating: number;
}

export interface AuthIdentity {
  token: string;
  refreshToken: string;
  expiresInSeconds: number;
  userId: number;
  email: string;
  role: string;
  tenantId: number;
}

export interface TenantBrandingDto {
  tenantId: number;
  brandName: string;
}

export interface WebSocketTicketDto {
  ticket: string;
  expiresInSeconds: number;
}

export interface NotificationDto {
  title?: string;
  message?: string;
  type?: string;
  referenceId?: number | null;
}

export interface RideUpdateEventDto {
  eventType?: string;
  rideId?: number | null;
  rideRequestId?: number | null;
  status?: string | null;
}

export interface Poi {
  id: string;
  name: string;
  kind: "airport" | "hotel" | "station" | "business" | "landmark";
  lat: number;
  lng: number;
  weight: number;
}

export interface RouteEntry {
  distanceM: number;
  durationS: number;
  polyline: string;
}

export interface RouteCatalogue {
  pois: Poi[];
  routes: Record<string, RouteEntry>;
}

export interface ControlDriver {
  email: string;
  name: string;
  state: ControlDriverState;
  poi: string | null;
  rideId: number | null;
  delayedUntil: number | null;
}

export interface ControlRider {
  email: string;
  name: string;
  state: RiderState;
  rideRequestId: number | null;
}

export interface ControlTenantStatus {
  slug: TenantSlug;
  name: string;
  currency: string;
  drivers: ControlDriver[];
  riders: ControlRider[];
  pendingRequests: number;
  activeTrips: number;
  completedTrips: number;
}

export interface ControlRecentError {
  at: string;
  message: string;
}

export interface ControlStatus {
  paused: boolean;
  speedFactor: number;
  uptimeSec: number;
  tenants: ControlTenantStatus[];
  recentErrors: ControlRecentError[];
}
