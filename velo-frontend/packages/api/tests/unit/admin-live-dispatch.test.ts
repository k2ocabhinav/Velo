import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { createAdminApi } from "../../src/admin";
import type { AdminLiveDispatchSnapshotDto, ApiResponse } from "../../src/types";

describe("admin live dispatch client", () => {
  it("requests the live snapshot with its abort signal and unwraps the API response", async () => {
    const snapshot: AdminLiveDispatchSnapshotDto = { generatedAt: "2026-10-15T10:00:00", drivers: [], rides: [] };
    const abort = new AbortController();
    let captured: AxiosRequestConfig | undefined;
    const client = {
      request: async (config: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<AdminLiveDispatchSnapshotDto>>> => {
        captured = config;
        return {
          data: { data: snapshot, error: "", statusCode: 200 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      },
    } as unknown as AxiosInstance;

    await expect(createAdminApi(client).getLiveDispatch(abort.signal)).resolves.toEqual(snapshot);
    expect(captured).toMatchObject({ method: "GET", url: "/api/v1/admin/dispatch/live", signal: abort.signal });
  });
});
