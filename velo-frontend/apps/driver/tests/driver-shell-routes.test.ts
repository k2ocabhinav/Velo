import { describe, expect, it } from "vitest";
import { isPublicDriverRoute } from "../app/_lib/driver-shell-routes";

describe("driver shell public routes", () => {
  it("keeps registration public so the shell skips protected requests", () => {
    expect(isPublicDriverRoute("/register")).toBe(true);
    expect(isPublicDriverRoute("/register/details")).toBe(true);
    expect(isPublicDriverRoute("/login")).toBe(true);
    expect(isPublicDriverRoute("/")).toBe(false);
  });
});
