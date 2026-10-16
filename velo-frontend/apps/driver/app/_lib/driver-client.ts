"use client";

import {
  requestProxyData,
  toCurrency,
  toRelativeTimestamp,
  unwrapPageItems
} from "@velo/app-core/browser-proxy";

export type DecimalValue = number | string;

export interface SpringPage<T> {
  content?: T[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface PointDto {
  coordinates?: [number, number] | number[];
  type?: string;
}

export interface DriverUserSummary {
  name?: string;
  email?: string;
  phoneNumber?: string | null;
  roles?: string[];
}

export interface DriverProfile {
  id: number;
  rating?: number | null;
  available: boolean;
  vehicleId?: string | null;
  onboardingStatus?: string | null;
  rejectionReason?: string | null;
  user?: DriverUserSummary | null;
}

export function isDriverApproved(profile: DriverProfile | null | undefined): boolean {
  // Older responses may omit the status; treat that as approved so the toggle still works.
  return !profile?.onboardingStatus || profile.onboardingStatus.toUpperCase() === "APPROVED";
}

export function isDriverRejected(profile: DriverProfile | null | undefined): boolean {
  return profile?.onboardingStatus?.toUpperCase() === "REJECTED";
}

/** "Rejected: <reason>" for a rejected application, or null when the driver is not rejected. */
export function getDriverRejectionMessage(profile: DriverProfile | null | undefined): string | null {
  if (!isDriverRejected(profile)) {
    return null;
  }
  const reason = profile?.rejectionReason?.trim();
  return reason ? `Rejected: ${reason}` : "Application rejected";
}

export interface DriverRidePerson {
  id?: number;
  rating?: number | null;
  vehicleId?: string | null;
  user?: DriverUserSummary | null;
}

export interface DriverRide {
  id: number;
  rideStatus: string;
  paymentMethod: string;
  pickupLocation?: PointDto | null;
  dropOffLocation?: PointDto | null;
  rider?: DriverRidePerson | null;
  driver?: DriverRidePerson | null;
  fare?: DecimalValue | null;
  otp?: string | null;
  createdTime?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  promoCode?: string | null;
  discountAmount?: DecimalValue | null;
  /** True once the driver has rated this ride's rider. */
  riderRated?: boolean;
  /** True once the rider has rated this ride's driver. */
  driverRated?: boolean;
}

export interface DriverRideRequestPreview {
  id: number;
  rideRequestStatus?: string | null;
  paymentMethod?: string | null;
  pickupLocation?: PointDto | null;
  dropOffLocation?: PointDto | null;
  pickupAddress?: string | null;
  dropOffAddress?: string | null;
  rider?: DriverRidePerson | null;
  fare?: DecimalValue | null;
  promoCode?: string | null;
  discountAmount?: DecimalValue | null;
  requestedTime?: string | null;
  expiresAt?: string | null;
}

export interface DriverNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdTime: string;
  referenceId?: number | null;
}

export interface DriverEarningItem {
  id: number;
  rideId?: number | null;
  grossFare: DecimalValue;
  platformCommission: DecimalValue;
  netEarning: DecimalValue;
  createdTime: string;
}

export interface DriverEarningsSummary {
  totalGross: DecimalValue;
  totalCommission: DecimalValue;
  totalNet: DecimalValue;
  rideCount: number;
  period: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DriverPayoutItem {
  id: number;
  amount: DecimalValue;
  status: string;
  requestedAt: string;
  processedAt?: string | null;
  adminNote?: string | null;
}

export async function requestDriverProxy<T>(path: string, init?: RequestInit): Promise<T> {
  return requestProxyData<T>(path, init, {
    pathPrefix: "/api/backend",
    defaultErrorMessage: "Request failed.",
    redirectOnUnauthorized: true,
    loginPath: "/login"
  });
}

export { unwrapPageItems, toCurrency, toRelativeTimestamp };
