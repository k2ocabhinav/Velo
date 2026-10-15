"use client";

import { requestAdminProxy } from "../../_lib/http";
import type { AdminLiveDispatchSnapshotDto } from "@velo/api/types";

export const adminClient = {
  getLiveDispatch(signal?: AbortSignal): Promise<AdminLiveDispatchSnapshotDto> {
    return requestAdminProxy<AdminLiveDispatchSnapshotDto>("api/v1/admin/dispatch/live", signal ? { signal } : undefined);
  },
};
