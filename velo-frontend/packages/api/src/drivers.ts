import type { AxiosInstance } from "axios";
import { createVeloClient, requestData, requestPageData } from "./client";
import type {
  DriverAvailabilityRequestDto,
  DriverDto,
  OffsetPageRequestInput,
  PaginatedResponse,
  RatingDto,
  RideDto,
  RideStartDto,
  RiderDto,
} from "./types";

export interface DriversApi {
  getMyProfile(): Promise<DriverDto>;
  setAvailability(available: boolean): Promise<DriverDto>;
  getMyRides(params?: OffsetPageRequestInput): Promise<PaginatedResponse<RideDto>>;
  acceptRide(rideRequestId: number): Promise<RideDto>;
  startRide(rideRequestId: number, input: RideStartDto): Promise<RideDto>;
  endRide(rideId: number): Promise<RideDto>;
  cancelRide(rideId: number): Promise<RideDto>;
  rateRider(input: RatingDto): Promise<RiderDto>;
}

export function createDriversApi(client: AxiosInstance = createVeloClient()): DriversApi {
  return {
    getMyProfile: () =>
      requestData<DriverDto>(client, {
        method: "GET",
        url: "/drivers/getMyProfile",
      }),
    setAvailability: (available) =>
      requestData<DriverDto>(client, {
        method: "PUT",
        url: "/drivers/availability",
        data: { available } satisfies DriverAvailabilityRequestDto,
      }),
    getMyRides: (params) =>
      requestPageData<RideDto>(client, {
        method: "GET",
        url: "/drivers/getMyRides",
        params,
      }),
    acceptRide: (rideRequestId) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/drivers/acceptRide/${rideRequestId}`,
      }),
    startRide: (rideRequestId, input) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/drivers/startRide/${rideRequestId}`,
        data: input,
      }),
    endRide: (rideId) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/drivers/endRide/${rideId}`,
      }),
    cancelRide: (rideId) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/drivers/cancelRide/${rideId}`,
      }),
    rateRider: (input) =>
      requestData<RiderDto>(client, {
        method: "POST",
        url: "/drivers/rateRider",
        data: input,
      }),
  };
}
