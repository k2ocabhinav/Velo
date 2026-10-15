import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  handleLoginFormPost,
  handleRegisterFormPost,
  isFormSubmission,
  isSameOriginFormRequest,
  readFormString,
} from "../src/auth";
import {
  authErrorCodeFromStatus,
  loginErrorMessage,
  registerErrorMessage,
} from "../src/auth-errors";

const ORIGIN = "http://localhost:4102";

function formRequest(
  path: string,
  fields: Record<string, string>,
  headers: Record<string, string> = { "sec-fetch-site": "same-origin" },
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields),
  });
}

describe("form submission detection", () => {
  it("recognises native form posts but not JSON requests", () => {
    expect(isFormSubmission(formRequest("/api/auth/login", {}))).toBe(true);
    expect(
      isFormSubmission(
        new Request(`${ORIGIN}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      ),
    ).toBe(false);
  });

  it("reads string fields defensively", () => {
    const form = new FormData();
    form.set("email", "a@b.co");
    expect(readFormString(form, "email")).toBe("a@b.co");
    expect(readFormString(form, "missing")).toBe("");
  });
});

describe("isSameOriginFormRequest", () => {
  it("accepts a same-origin Sec-Fetch-Site", () => {
    expect(
      isSameOriginFormRequest(formRequest("/api/auth/login", {}, { "sec-fetch-site": "same-origin" })),
    ).toBe(true);
  });

  it("rejects cross-site, same-site and direct Sec-Fetch-Site values", () => {
    expect(isSameOriginFormRequest(formRequest("/x", {}, { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginFormRequest(formRequest("/x", {}, { "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginFormRequest(formRequest("/x", {}, { "sec-fetch-site": "none" }))).toBe(false);
  });

  it("falls back to comparing Origin against Host when Sec-Fetch-Site is absent", () => {
    expect(
      isSameOriginFormRequest(formRequest("/x", {}, { origin: "https://app.velo.dev", host: "app.velo.dev" })),
    ).toBe(true);
    expect(
      isSameOriginFormRequest(formRequest("/x", {}, { origin: "https://evil.example", host: "app.velo.dev" })),
    ).toBe(false);
  });

  it("accepts an Origin matching the forwarded host behind a proxy", () => {
    expect(
      isSameOriginFormRequest(
        formRequest("/x", {}, { origin: "https://app.velo.dev", "x-forwarded-host": "app.velo.dev", host: "internal:3000" }),
      ),
    ).toBe(true);
  });

  it("rejects when neither Sec-Fetch-Site nor a usable Origin is present", () => {
    expect(isSameOriginFormRequest(formRequest("/x", {}, {}))).toBe(false);
    expect(isSameOriginFormRequest(formRequest("/x", {}, { host: "app.velo.dev" }))).toBe(false);
  });
});

describe("handleLoginFormPost", () => {
  it("redirects a successful no-JS login without leaking the password", async () => {
    const login = vi.fn(async () => {
      const response = NextResponse.json({ ok: true });
      response.cookies.set("velo_rider_token", "token-123", { httpOnly: true, path: "/" });
      return response;
    });

    const response = await handleLoginFormPost(
      formRequest("/api/auth/login", { email: "rider@example.com", password: "hunter2", next: "/wallet" }),
      login,
      "/login",
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/wallet");
    expect(location).not.toContain("hunter2");
    expect(response.cookies.get("velo_rider_token")?.value).toBe("token-123");
    expect(login).toHaveBeenCalledWith({ email: "rider@example.com", password: "hunter2" });
  });

  it("refuses a cross-site form post without calling the backend", async () => {
    const login = vi.fn(async () => NextResponse.json({ ok: true }));

    const response = await handleLoginFormPost(
      formRequest("/api/auth/login", { email: "rider@example.com", password: "hunter2" }, { "sec-fetch-site": "cross-site" }),
      login,
      "/login",
    );

    expect(response.status).toBe(403);
    expect(login).not.toHaveBeenCalled();
  });

  it("redirects a failed no-JS login with an error code, never the reflected message", async () => {
    const login = vi.fn(async () =>
      NextResponse.json({ error: "Invalid email or password." }, { status: 401 }),
    );

    const response = await handleLoginFormPost(
      formRequest("/api/auth/login", { email: "rider@example.com", password: "hunter2" }),
      login,
      "/login",
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("error=invalid_credentials");
    expect(location).not.toContain("Invalid");
    expect(location).not.toContain("hunter2");
  });

  it("maps upstream statuses to the matching error codes", async () => {
    const cases: Array<[number, string]> = [
      [401, "invalid_credentials"],
      [403, "not_authorized"],
      [429, "rate_limited"],
      [502, "unavailable"],
      [500, "login_failed"],
    ];

    for (const [status, code] of cases) {
      const login = async () => NextResponse.json({ error: "upstream text" }, { status });
      const response = await handleLoginFormPost(
        formRequest("/api/auth/login", { email: "a@b.co", password: "x" }),
        login,
        "/login",
      );
      const location = response.headers.get("location") ?? "";
      expect(location).toContain(`error=${code}`);
      expect(location).not.toContain("upstream");
    }
  });

  it("sanitises an external next path on success", async () => {
    const login = async () => NextResponse.json({ ok: true });
    const response = await handleLoginFormPost(
      formRequest("/api/auth/login", { email: "a@b.co", password: "x", next: "https://evil.example/pwn" }),
      login,
      "/login",
    );

    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/");
  });
});

describe("handleRegisterFormPost", () => {
  it("redirects to the login page after a successful no-JS registration", async () => {
    const register = vi.fn(async () => NextResponse.json({ success: true }, { status: 201 }));

    const response = await handleRegisterFormPost(
      formRequest("/api/auth/register", { name: "Rae", email: "rae@example.com", password: "hunter2", next: "/wallet" }),
      register,
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/login");
    expect(new URL(location).searchParams.get("next")).toBe("/wallet");
    expect(location).not.toContain("hunter2");
    expect(register.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
  });

  it("refuses a cross-site form post without calling the backend", async () => {
    const register = vi.fn(async () => NextResponse.json({ success: true }, { status: 201 }));

    const response = await handleRegisterFormPost(
      formRequest("/api/auth/register", { name: "Rae", email: "rae@example.com", password: "hunter2" }, { "sec-fetch-site": "cross-site" }),
      register,
    );

    expect(response.status).toBe(403);
    expect(register).not.toHaveBeenCalled();
  });

  it("redirects a failed registration with a code, never the reflected message", async () => {
    const register = vi.fn(async () =>
      NextResponse.json({ error: "Email already registered." }, { status: 409 }),
    );

    const response = await handleRegisterFormPost(
      formRequest("/api/auth/register", { name: "Rae", email: "rae@example.com", password: "hunter2" }),
      register,
    );

    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/register");
    expect(location).toContain("error=email_in_use");
    expect(location).not.toContain("already+registered");
    expect(location).not.toContain("hunter2");
  });

  it("maps an unexpected upstream failure to register_failed", async () => {
    const register = async () => NextResponse.json({ error: "boom" }, { status: 500 });

    const response = await handleRegisterFormPost(
      formRequest("/api/auth/register", { name: "Rae", email: "rae@example.com", password: "hunter2" }),
      register,
    );

    expect(response.headers.get("location")).toContain("error=register_failed");
  });
});

describe("auth error code mapping", () => {
  it("derives codes from upstream status per flow", () => {
    expect(authErrorCodeFromStatus(401, "login")).toBe("invalid_credentials");
    expect(authErrorCodeFromStatus(429, "login")).toBe("rate_limited");
    expect(authErrorCodeFromStatus(504, "login")).toBe("unavailable");
    expect(authErrorCodeFromStatus(500, "login")).toBe("login_failed");
    expect(authErrorCodeFromStatus(409, "register")).toBe("email_in_use");
    expect(authErrorCodeFromStatus(500, "register")).toBe("register_failed");
  });

  it("maps known codes to fixed messages and unknown codes to a generic message", () => {
    expect(loginErrorMessage("invalid_credentials")).toBe("Couldn't sign in. Check your email and password.");
    expect(registerErrorMessage("email_in_use")).toBe("That email address is already registered.");
    expect(loginErrorMessage("hunter2")).toBe("Something went wrong. Please try again.");
    expect(registerErrorMessage("made-up")).toBe("Something went wrong. Please try again.");
    expect(loginErrorMessage(null)).toBeNull();
    expect(registerErrorMessage(undefined)).toBeNull();
  });
});
