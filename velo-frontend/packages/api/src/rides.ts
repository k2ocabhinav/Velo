import type { AxiosInstance } from "axios";
import { createVeloClient, requestData, requestPageData } from "./client";
import type {
  DriverDto,
  FareEstimateDto,
  FareEstimateRequestDto,
  OffsetPageRequestInput,
  PageRequestInput,
  PaginatedResponse,
  RatingDto,
  RideDto,
  RideRequestDto,
  RiderDto,
  ScheduledRideDto,
} from "./types";

export interface RidesApi {
  getFareEstimate(input: FareEstimateRequestDto): Promise<FareEstimateDto>;
  requestRide(input: RideRequestDto): Promise<RideRequestDto>;
  cancelRide(rideId: number): Promise<RideDto>;
  rateDriver(input: RatingDto): Promise<DriverDto>;
  getMyProfile(): Promise<RiderDto>;
  getMyRides(params?: OffsetPageRequestInput): Promise<PaginatedResponse<RideDto>>;
  scheduleRide(input: RideRequestDto): Promise<ScheduledRideDto>;
  getScheduledRides(params?: PageRequestInput): Promise<PaginatedResponse<ScheduledRideDto>>;
  cancelScheduledRide(rideId: number): Promise<ScheduledRideDto>;
  rescheduleScheduledRide(rideId: number, newTime: string): Promise<ScheduledRideDto>;
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
      requestData<RideDto>(client, {
        method: "POST",
        url: `/riders/cancelRide/${rideId}`,
      }),
    rateDriver: (input) =>
      requestData<DriverDto>(client, {
        method: "POST",
        url: "/riders/rateDriver",
        data: input,
      }),
    getMyProfile: () =>
      requestData<RiderDto>(client, {
        method: "GET",
        url: "/riders/getMyProfile",
      }),
    getMyRides: (params) =>
      requestPageData<RideDto>(client, {
        method: "GET",
        url: "/riders/getMyRides",
        params,
      }),
    scheduleRide: (input) =>
      requestData<ScheduledRideDto>(client, {
        method: "POST",
        url: "/riders/schedule-ride",
        data: input,
      }),
    getScheduledRides: (params) =>
      requestPageData<ScheduledRideDto>(client, {
        method: "GET",
        url: "/riders/scheduled-rides",
        params,
      }),
    cancelScheduledRide: (rideId) =>
      requestData<ScheduledRideDto>(client, {
        method: "DELETE",
        url: `/riders/scheduled-rides/${rideId}`,
      }),
    rescheduleScheduledRide: (rideId, newTime) =>
      requestData<ScheduledRideDto>(client, {
        method: "PUT",
        url: `/riders/scheduled-rides/${rideId}/reschedule`,
        params: { newTime },
      }),
  };
}
