import { describe, expect, it } from "vitest";
import { buildAdminCreateRiderPayload } from "../app/(protected)/_lib/admin-client";

describe("admin client rider create payload", () => {
  it("combines first and last name into backend signup name", () => {
    const payload = buildAdminCreateRiderPayload({
      firstName: "Ava",
      lastName: "Sharma",
      email: "ava@example.com",
      password: "password123",
    });

    expect(payload).toEqual({
      name: "Ava Sharma",
      email: "ava@example.com",
      password: "password123",
    });
  });

  it("falls back to email when name fields are blank", () => {
    const payload = buildAdminCreateRiderPayload({
      firstName: "   ",
      lastName: "",
      email: "fallback@example.com",
      password: "password123",
    });

    expect(payload.name).toBe("fallback@example.com");
  });
});
