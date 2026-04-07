import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type {
  FareEstimateDto,
  FareEstimateRequestDto,
  ISODateTime,
  PaginatedResponse,
  RatingDto,
  RideDto,
  RideRequestDto,
  ScheduledRideDto,
} from "./types";

export interface RideScheduleRequestDto {
  pickupLocation: RideRequestDto["pickupLocation"];
  dropOffLocation: RideRequestDto["dropOffLocation"];
  scheduledTime: ISODateTime;
  paymentMethod: string;
  promoCode?: string;
}

export interface RidesApi {
  getFareEstimate(input: FareEstimateRequestDto): Promise<FareEstimateDto>;
  requestRide(input: RideRequestDto): Promise<RideRequestDto>;
  cancelRide(rideId: number): Promise<void>;
  rateDriver(input: RatingDto): Promise<void>;
  getMyRides(params?: { page?: number; size?: number }): Promise<PaginatedResponse<RideDto>>;
  getRide(rideId: number): Promise<RideDto>;
  scheduleRide(input: RideScheduleRequestDto): Promise<ScheduledRideDto>;
  getScheduledRides(): Promise<ScheduledRideDto[]>;
  cancelScheduledRide(rideId: number): Promise<void>;
  rescheduleScheduledRide(rideId: number, scheduledTime: string): Promise<ScheduledRideDto>;
  trackRide(rideId: number): Promise<RideDto>;
}

export function createRidesApi(client: AxiosInstance = createVeloClient()): RidesApi {
  return {
    getFareEstimate: (input) =>
      requestData<FareEstimateDto>(client, {
        method: "POST",
        url: "/riders/fare-estimate",
        data: input,
      }),
    requestRide: (input) =>
      requestData<RideRequestDto>(client, {
        method: "POST",
        url: "/riders/requestRide",
        data: input,
      }),
    cancelRide: (rideId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/riders/cancelRide/${rideId}`,
      }).then(() => undefined),
    rateDriver: (input) =>
      requestData<void>(client, {
        method: "POST",
        url: "/riders/rateDriver",
        data: input,
      }).then(() => undefined),
    getMyRides: (params) =>
      requestData<PaginatedResponse<RideDto>>(client, {
        method: "GET",
        url: "/riders/getMyRides",
        params,
      }),
    getRide: (rideId) =>
      requestData<RideDto>(client, {
        method: "GET",
        url: `/rides/${rideId}`,
      }),
    scheduleRide: (input) =>
      requestData<ScheduledRideDto>(client, {
        method: "POST",
        url: "/riders/schedule-ride",
        data: input,
      }),
    getScheduledRides: () =>
      requestData<ScheduledRideDto[]>(client, {
        method: "GET",
        url: "/riders/scheduled-rides",
      }),
    cancelScheduledRide: (rideId) =>
      requestData<void>(client, {
        method: "DELETE",
        url: `/riders/scheduled-rides/${rideId}`,
      }).then(() => undefined),
    rescheduleScheduledRide: (rideId, scheduledTime) =>
      requestData<ScheduledRideDto>(client, {
        method: "PUT",
        url: `/riders/scheduled-rides/${rideId}/reschedule`,
        data: { scheduledTime },
      }),
    trackRide: (rideId) =>
      requestData<RideDto>(client, {
        method: "GET",
        url: `/rides/${rideId}/track`,
      }),
  };
}
