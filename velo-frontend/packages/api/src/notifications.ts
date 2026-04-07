import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { NotificationDto, UnreadCountDto } from "./types";

export interface NotificationsApi {
  listNotifications(): Promise<NotificationDto[]>;
  getUnreadCount(): Promise<UnreadCountDto>;
  markRead(id: number): Promise<NotificationDto>;
  markAllRead(): Promise<void>;
}

export function createNotificationsApi(
  client: AxiosInstance = createVeloClient(),
): NotificationsApi {
  return {
    listNotifications: () =>
      requestData<NotificationDto[]>(client, {
        method: "GET",
        url: "/notifications",
      }),
    getUnreadCount: () =>
      requestData<UnreadCountDto>(client, {
        method: "GET",
        url: "/notifications/unread-count",
      }),
    markRead: (id) =>
      requestData<NotificationDto>(client, {
        method: "POST",
        url: `/notifications/${id}/read`,
      }),
    markAllRead: () =>
      requestData<void>(client, {
        method: "POST",
        url: "/notifications/read-all",
      }).then(() => undefined),
  };
}
