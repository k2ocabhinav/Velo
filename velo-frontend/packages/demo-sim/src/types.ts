export type TenantSlug = "default" | "saffron-routes";
export type SimRole = "DRIVER" | "RIDER";
export type DriverState = "idle" | "thinking" | "to-pickup" | "waiting-rider" | "on-trip" | "repositioning" | "stopping";

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
  name: string;
  state: DriverState;
  rideId: number | null;
}

export interface ControlTenantStatus {
  drivers: ControlDriver[];
  activeTrips: number;
  completedCount: number;
  recentErrors: string[];
}

export interface ControlStatus {
  paused: boolean;
  speed: number;
  uptimeSeconds: number;
  tenants: Partial<Record<TenantSlug, ControlTenantStatus>>;
}
