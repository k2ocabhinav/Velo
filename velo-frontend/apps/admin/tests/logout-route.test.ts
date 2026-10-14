import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/logout/route";

describe("admin logout route", () => {
  it("clears auth cookies and returns success", async () => {
    const response = await POST(new NextRequest("http://admin.velo.test/api/auth/logout"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const cookies = response.cookies.getAll();
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_admin_token", value: "" }),
        expect.objectContaining({ name: "velo_admin_user_id", value: "" }),
        expect.objectContaining({ name: "velo_admin_role_hint", value: "" }),
      ]),
    );
  });
});
