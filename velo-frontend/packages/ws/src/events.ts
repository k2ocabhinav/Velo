import type { IMessage } from "@stomp/stompjs";

export interface NotificationEvent {
  id?: string | number;
  type?: string;
  title?: string;
  message?: string;
  read?: boolean;
  createdAt?: string;
  rideId?: string | number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RideUpdateEvent {
  eventType?: string;
  rideId?: string | number;
  rideRequestId?: string | number;
  status?: string;
  driverId?: string | number;
  riderId?: string | number;
  etaMinutes?: number;
  updatedAt?: string;
  routePolyline?: string | null;
  driverLocation?: {
    lat?: number;
    lng?: number;
    heading?: number;
    speedKph?: number;
    accuracyM?: number;
    capturedAt?: string;
    [key: string]: unknown;
  };
  location?: {
    lat?: number;
    lng?: number;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

function parseJsonMessageBody<T>(message: IMessage): T | null {
  const body = message.body?.trim();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export function parseNotificationEventMessage(message: IMessage): NotificationEvent | null {
  return parseJsonMessageBody<NotificationEvent>(message);
}

export function parseRideUpdateEventMessage(message: IMessage): RideUpdateEvent | null {
  return parseJsonMessageBody<RideUpdateEvent>(message);
}
