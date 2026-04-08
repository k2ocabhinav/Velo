export type ISODate = string;
export type ISODateTime = string;
export type DecimalValue = number | string;

export interface ApiResponse<T> {
  data: T;
  error: string;
  statusCode: number;
}

export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface SpringPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  numberOfElements?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
  pageable?: {
    pageNumber?: number;
    pageSize?: number;
  };
}

export interface PageRequestInput {
  page?: number;
  size?: number;
}

export interface OffsetPageRequestInput {
  pageOffset?: number;
  pageSize?: number;
}

export interface PointDto {
  coordinates: [number, number];
  type: "Point";
}

export interface UserDto {
  name: string;
  email: string;
  roles: string[];
}

export interface AdminUserDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  active: boolean;
  referralCode?: string | null;
  createdTime?: ISODateTime;
  roles: string[];
  version?: number | null;
}

export interface SignupDto {
  name: string;
  email: string;
  password: string;
  referredByCode?: string;
}

export type RegisterRequestDto = SignupDto;

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequestDto {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface OnboardDriverDto {
  vehicleId: string;
}

export interface AuthResponseDto {
  token: string;
  userId: number;
  email: string;
  role: string;
}

export interface DriverDto {
  id: number;
  user: UserDto;
  rating: number;
  available: boolean;
  vehicleId: string;
}

export interface RiderDto {
  id: number;
  user: UserDto;
  rating: number;
}

export interface DriverAvailabilityRequestDto {
  available: boolean;
}

export interface DriverLocationUpdateRequestDto {
  lat: number;
  lng: number;
  heading?: number | null;
  speedKph?: number | null;
  accuracyM?: number | null;
  capturedAt?: ISODateTime | null;
}

export interface DriverLocationDto {
  lat: number;
  lng: number;
  heading?: number | null;
  speedKph?: number | null;
  accuracyM?: number | null;
  capturedAt?: ISODateTime | null;
  updatedAt?: ISODateTime | null;
}

export interface RideStartDto {
  otp: string;
}

export interface RatingDto {
  rideId: number;
  rating: number;
}

export interface PathRatingInput {
  rideId: number;
  rating: number;
}

export interface FareEstimateRequestDto {
  pickupLocation: PointDto;
  dropOffLocation: PointDto;
  paymentMethod: string;
  promoCode?: string;
}

export interface FareEstimateDto {
  estimatedFare: DecimalValue;
  baseFare: DecimalValue;
  surgeMultiplier: number;
  discountAmount: DecimalValue;
  distanceKm: number;
  durationMinutes: number;
  estimatedPickupTime?: ISODateTime | null;
  applicablePromos: PromoCodeDto[];
}

export interface PromoCodeDto {
  id: number;
  code: string;
  discountType: string;
  discountValue: DecimalValue;
  maxUses?: number | null;
  currentUses?: number | null;
  startDate?: ISODate | null;
  endDate?: ISODate | null;
  minRideFare?: DecimalValue | null;
  active: boolean;
  description?: string | null;
}

export interface ScheduledRideDto {
  id: number;
  pickupLocation: PointDto;
  dropOffLocation: PointDto;
  paymentMethod: string;
  fare: DecimalValue;
  scheduledTime: ISODateTime;
  status: string;
  requestedTime?: ISODateTime | null;
}

export interface RideRequestDto {
  id?: number;
  pickupLocation: PointDto;
  dropOffLocation: PointDto;
  paymentMethod: string;
  requestedTime?: ISODateTime | null;
  fare?: DecimalValue | null;
  promoCode?: string | null;
  discountAmount?: DecimalValue | null;
  rider?: RiderDto | null;
  rideRequestStatus?: string | null;
  scheduledTime?: ISODateTime | null;
}

export interface RideDto {
  id: number;
  pickupLocation: PointDto;
  dropOffLocation: PointDto;
  createdTime?: ISODateTime | null;
  startedAt?: ISODateTime | null;
  endedAt?: ISODateTime | null;
  rider?: RiderDto | null;
  driver?: DriverDto | null;
  otp?: string | null;
  paymentMethod: string;
  rideStatus: string;
  fair?: DecimalValue | null;
  promoCode?: string | null;
  discountAmount?: DecimalValue | null;
}

export interface RideLocationDto {
  lat: number;
  lng: number;
  heading?: number | null;
  speedKph?: number | null;
  accuracyM?: number | null;
  capturedAt?: ISODateTime | null;
}

export interface RideTrackingDriverDto {
  id: number;
  name?: string | null;
  vehicleId?: string | null;
  rating?: number | null;
}

export interface RideTrackingDto {
  rideId?: number | null;
  rideRequestId?: number | null;
  status?: string | null;
  pickupLocation?: PointDto | null;
  dropOffLocation?: PointDto | null;
  driver?: RideTrackingDriverDto | null;
  lastDriverLocation?: RideLocationDto | null;
  etaMinutes?: number | null;
  routePolyline?: string | null;
  updatedAt?: ISODateTime | null;
  canCancel?: boolean | null;
}

export interface RideUpdateEventDto {
  eventType: "RIDE_STATUS_CHANGED" | "DRIVER_LOCATION_UPDATED" | "RIDE_COMPLETED" | "RIDE_CANCELLED";
  rideId?: number | null;
  rideRequestId?: number | null;
  status?: string | null;
  riderId?: number | null;
  driverId?: number | null;
  driverLocation?: RideLocationDto | null;
  etaMinutes?: number | null;
  routePolyline?: string | null;
  updatedAt?: ISODateTime | null;
}

export interface PaymentMethodDto {
  id: number;
  type: string;
  lastFourDigits: string;
  expiryDate: string;
  isDefault: boolean;
}

export interface PayoutRequestDto {
  id: number;
  amount: DecimalValue;
  status: string;
  requestedAt: ISODateTime;
  processedAt?: ISODateTime | null;
  adminNote?: string | null;
}

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId?: number | null;
  read: boolean;
  createdTime: ISODateTime;
}

export interface DriverEarningDto {
  id: number;
  rideId?: number | null;
  grossFare: DecimalValue;
  platformCommission: DecimalValue;
  netEarning: DecimalValue;
  createdTime: ISODateTime;
}

export interface EarningsSummaryDto {
  totalGross: DecimalValue;
  totalCommission: DecimalValue;
  totalNet: DecimalValue;
  rideCount: number;
  period: string;
  startDate?: ISODateTime | null;
  endDate?: ISODateTime | null;
}

export interface DashboardDto {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  totalRevenue: DecimalValue;
  activeRides: number;
  pendingApprovals: number;
  ridesByStatus: Record<string, number>;
  revenueByDay: Record<string, DecimalValue>;
}

export interface AdminStatsDto {
  date: ISODate;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRevenue: DecimalValue;
  platformCommission: DecimalValue;
  totalUsers: number;
  newUsers: number;
  activeDrivers: number;
  pendingDriverApprovals: number;
}

export interface PendingDriverDto {
  driverId: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  rating: number;
  vehicleId: string;
  appliedAt: ISODateTime;
}

export interface RevenueReportDto {
  date: ISODate;
  grossRevenue: DecimalValue;
  platformCommission: DecimalValue;
  driverEarnings: DecimalValue;
  rideCount: number;
}
