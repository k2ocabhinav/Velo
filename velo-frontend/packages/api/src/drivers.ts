import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { DriverProfileDto, RideDto, RideStartDto, RatingDto, UserSummaryDto } from "./types";

export interface DriversApi {
  getMyProfile(): Promise<DriverProfileDto>;
  updateMyProfile(input: Partial<DriverProfileDto>): Promise<DriverProfileDto>;
  toggleAvailability(available: boolean): Promise<DriverProfileDto>;
  getMyRides(): Promise<RideDto[]>;
  acceptRide(rideRequestId: number): Promise<RideDto>;
  startRide(rideRequestId: number, input: RideStartDto): Promise<RideDto>;
  endRide(rideId: number): Promise<RideDto>;
  cancelRide(rideId: number): Promise<RideDto>;
  rateRider(input: RatingDto): Promise<void>;
}

export function createDriversApi(client: AxiosInstance = createVeloClient()): DriversApi {
  return {
    getMyProfile: () =>
      requestData<DriverProfileDto>(client, {
        method: "GET",
        url: "/drivers/getMyProfile",
      }),
    updateMyProfile: (input) =>
      requestData<DriverProfileDto>(client, {
        method: "PUT",
        url: "/drivers/profile",
        data: input,
      }),
    toggleAvailability: (available) =>
      requestData<DriverProfileDto>(client, {
        method: "PUT",
        url: "/drivers/availability",
        data: { available },
      }),
    getMyRides: () =>
      requestData<RideDto[]>(client, {
        method: "GET",
        url: "/drivers/getMyRides",
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
      requestData<void>(client, {
        method: "POST",
        url: "/drivers/rateRider",
        data: input,
      }).then(() => undefined),
  };
}
