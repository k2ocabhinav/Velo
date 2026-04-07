import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthHeaders,
  isApiResponse,
  requestData,
  requestPageData,
  resolveBrowserToken,
  resolveServerToken,
  unwrapApiResponse,
  unwrapSpringPage,
} from "../../src/client";
import type { ApiResponse, SpringPage } from "../../src/types";

function createMockClient<T>(responseData: T | ApiResponse<T>) {
  const requestCalls: AxiosRequestConfig[] = [];

  const client = {
    request: async (config: AxiosRequestConfig): Promise<AxiosResponse<T | ApiResponse<T>>> => {
      requestCalls.push(config);

      return {
        data: responseData,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    },
  } as unknown as AxiosInstance;

  return { client, requestCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client helpers", () => {
  it("normalizes bearer tokens for auth headers", () => {
    expect(buildAuthHeaders("abc123")).toEqual({ Authorization: "Bearer abc123" });
    expect(buildAuthHeaders("Bearer xyz")).toEqual({ Authorization: "Bearer xyz" });
  });

  it("resolves server tokens from authorization headers first", () => {
    expect(resolveServerToken({ authorization: "Bearer server-token" })).toBe("Bearer server-token");
    expect(resolveServerToken({ cookie: "velo_token=cookie-token" })).toBe("cookie-token");
  });

  it("resolves browser tokens from cookies only", () => {
    vi.stubGlobal("window", {
      document: {
        cookie: "other=1; velo_token=browser-token; theme=dark",
      },
    } as { document: { cookie: string } });

    expect(resolveBrowserToken()).toBe("browser-token");
  });

  it("detects wrapped api responses", () => {
    expect(isApiResponse({ data: 1, error: "", statusCode: 200 })).toBe(true);
    expect(isApiResponse({ ok: true })).toBe(false);
  });

  it("unwraps api response payloads", () => {
    expect(unwrapApiResponse({ data: { hello: "world" }, error: "", statusCode: 200 })).toEqual({
      hello: "world",
    });
    expect(unwrapApiResponse({ hello: "world" })).toEqual({ hello: "world" });
  });

  it("unwraps spring pages into stable paginated responses", () => {
    const page = unwrapSpringPage({
      content: [{ id: 1 }, { id: 2 }],
      number: 3,
      size: 25,
      totalElements: 90,
      totalPages: 4,
      pageable: {
        pageNumber: 3,
        pageSize: 25,
      },
    } satisfies SpringPage<{ id: number }>);

    expect(page).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      meta: {
        page: 3,
        size: 25,
        total: 90,
        totalPages: 4,
      },
    });
  });

  it("unwraps wrapped spring pages from requestPageData", async () => {
    const { client, requestCalls } = createMockClient({
      data: {
        content: [{ id: 1 }],
        number: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
      },
      error: "",
      statusCode: 200,
    } satisfies ApiResponse<SpringPage<{ id: number }>>);

    const payload = await requestPageData<{ id: number }>(client, {
      method: "GET",
      url: "/page",
    });

    expect(payload).toEqual({
      items: [{ id: 1 }],
      meta: {
        page: 0,
        size: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0]).toMatchObject({ method: "GET", url: "/page" });
  });

  it("unwraps plain requestData payloads", async () => {
    const { client, requestCalls } = createMockClient({ hello: "world" });

    const payload = await requestData<{ hello: string }>(client, {
      method: "GET",
      url: "/health",
    });

    expect(payload).toEqual({ hello: "world" });
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0]).toMatchObject({ method: "GET", url: "/health" });
  });
});
