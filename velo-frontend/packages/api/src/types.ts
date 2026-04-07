export interface ApiResponse<T> {
  data: T;
  error: string;
  statusCode: number;
}

export type Identifier = number | string;
export type ISODateTime = string;
export type CurrencyCode = string;

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

export interface LocationPoint {
  latitude: number;
  longitude: number;
  address?: string;
  label?: string;
}

export interface MoneyAmount {
  amount: number;
  currency: CurrencyCode;
}

export interface UserSummaryDto {
  id: number;
  name: string;
  email: string;
  phone?: string;
  active?: boolean;
  roles?: string[];
}

export interface AuthResponseDto {
  token: string;
  userId: number;
  email: string;
  role: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface SignupDto {
  name: string;
  email: string;
  password: string;
  referredByCode?: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequestDto {
  name?: string;
  phone?: string;
}

export interface DriverProfileDto {
  id: number;
  user: UserSummaryDto;
  rating: number;
  available: boolean;
  vehicleId: string;
}

export interface DriverApprovalDto {
  driverId: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  rating: number;
  vehicleId: string;
  appliedAt: ISODateTime;
}

export interface AdminDashboardDto {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  totalRevenue: number;
  activeRides: number;
  pendingApprovals: number;
  ridesByStatus: Record<string, number>;
  revenueByDay: Array<{
    date: ISODateTime;
    revenue: number;
  }>;
}

export interface AdminStatsDto {
  date: ISODateTime;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRevenue: number;
  platformCommission: number;
  totalUsers: number;
  newUsers: number;
  activeDrivers: number;
  pendingDriverApprovals: number;
}

export interface RevenueReportDto {
  date: ISODateTime;
  grossRevenue: number;
  platformCommission: number;
  driverEarnings: number;
  rideCount: number;
}

export interface UserAdminDto {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  active: boolean;
  createdAt?: ISODateTime;
}

export interface PayoutDto {
  id: number;
  driverId: number;
  driverName?: string;
  amount: number;
  currency: CurrencyCode;
  status: string;
  requestedAt: ISODateTime;
  processedAt?: ISODateTime;
  reason?: string;
}

export interface PromoCodeDto {
  id: number;
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number;
  minimumRideAmount?: number;
  usageLimit?: number;
  usedCount?: number;
  active: boolean;
  startsAt?: ISODateTime;
  endsAt?: ISODateTime;
}

export interface PromoCodeCreateDto {
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number;
  minimumRideAmount?: number;
  usageLimit?: number;
  startsAt?: ISODateTime;
  endsAt?: ISODateTime;
  active?: boolean;
}

export interface PromoCodeUpdateDto extends Partial<PromoCodeCreateDto> {}

export interface ScheduledRideDto {
  id: number;
  riderId: number;
  riderName?: string;
  pickupLocation: LocationPoint;
  dropOffLocation: LocationPoint;
  requestedTime?: ISODateTime;
  scheduledTime: ISODateTime;
  rideRequestStatus?: string;
  paymentMethod?: string;
  fare?: number;
  promoCode?: string;
  discountAmount?: number;
}

export interface RideRequestDto {
  id: number;
  pickupLocation: LocationPoint;
  dropOffLocation: LocationPoint;
  paymentMethod: string;
  requestedTime?: ISODateTime;
  fare?: number;
  promoCode?: string;
  discountAmount?: number;
  rider?: UserSummaryDto;
  rideRequestStatus?: string;
  scheduledTime?: ISODateTime;
}

export interface RideDto {
  id: number;
  pickupLocation: LocationPoint;
  dropOffLocation: LocationPoint;
  createdTime?: ISODateTime;
  startedAt?: ISODateTime;
  endedAt?: ISODateTime;
  rider?: UserSummaryDto;
  driver?: DriverProfileDto;
  otp?: string;
  paymentMethod: string;
  rideStatus: string;
  fare?: number;
  promoCode?: string;
  discountAmount?: number;
}

export interface RideStartDto {
  otp: string;
}

export interface RatingDto {
  rideId: number;
  rating: number;
}

export interface PointDto {
  coordinates: [number, number];
  type: "Point";
}

export interface FareEstimateRequestDto {
  pickupLocation: LocationPoint;
  dropOffLocation: LocationPoint;
  paymentMethod: string;
  promoCode?: string;
}

export interface FareEstimateDto {
  estimatedFare: number;
  baseFare: number;
  surgeMultiplier: number;
  discountAmount: number;
  distanceKm: number;
  durationMinutes: number;
  estimatedPickupTime?: ISODateTime;
  applicablePromos: PromoCodeDto[];
}

export interface PaymentMethodDto {
  id: number;
  type: string;
  lastFour: string;
  isDefault: boolean;
  brand?: string;
  expMonth?: number;
  expYear?: number;
}

export interface WalletDto {
  id: number;
  balance: number;
  currency: CurrencyCode;
}

export interface WalletTransactionDto {
  id: number;
  ride?: RideDto;
  transactionId?: string;
  wallet?: WalletDto;
  amount: number;
  type: string;
  method?: string;
  status: string;
  timeStamp: ISODateTime;
}

export interface DriverEarningDto {
  id: number;
  rideId?: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  earnedAt: ISODateTime;
  status?: string;
}

export interface EarningsSummaryDto {
  period: string;
  totalEarnings: number;
  totalPayouts: number;
  balance: number;
  rideCount: number;
}

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId?: number;
  read: boolean;
  createdTime: ISODateTime;
}

export interface UnreadCountDto {
  count: number;
}
