import type { AxiosInstance } from "axios";
import { createVeloClient, requestData, requestPageData } from "./client";
import type {
  NotificationDto,
  PageRequestInput,
  PaginatedResponse,
} from "./types";

export interface NotificationsApi {
  listNotifications(params?: PageRequestInput): Promise<PaginatedResponse<NotificationDto>>;
  getUnreadCount(): Promise<number>;
  markRead(id: number): Promise<NotificationDto>;
  markAllRead(): Promise<void>;
}

export function createNotificationsApi(
  client: AxiosInstance = createVeloClient(),
): NotificationsApi {
  return {
    listNotifications: (params) =>
      requestPageData<NotificationDto>(client, {
        method: "GET",
        url: "/notifications",
        params,
      }),
    getUnreadCount: () =>
      requestData<number>(client, {
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
