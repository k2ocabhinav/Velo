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
  user?: DriverUserSummary | null;
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
}

export interface DriverRideRequestPreview {
  id: number;
  rideRequestStatus?: string | null;
  paymentMethod?: string | null;
  pickupLocation?: PointDto | null;
  dropOffLocation?: PointDto | null;
  fare?: DecimalValue | null;
  promoCode?: string | null;
  discountAmount?: DecimalValue | null;
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
