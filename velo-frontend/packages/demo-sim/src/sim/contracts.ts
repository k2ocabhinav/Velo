import type { SimAccount, Poi } from "../types.ts";

export interface RidePlan {
  requestId: number;
  rider: SimAccount;
  pickup: Poi;
  dropOff: Poi;
  readOtp(rideId: number): Promise<string | null>;
  rateDriver(rideId: number, rating: number): Promise<void>;
  onAssigned(rideId: number): void;
  onStarted(rideId: number): void;
  onCompleted(): void;
}

export interface RideRegistry {
  beginRequest(): void;
  endRequest(): void;
  isRequestBeingCreated(): boolean;
  register(plan: RidePlan): void;
  owns(requestId: number): boolean;
  get(requestId: number): RidePlan | undefined;
  claimFirstOffer(requestId: number): boolean;
  consumeForcedDecline(): boolean;
  complete(requestId: number): void;
}
