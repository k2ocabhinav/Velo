import { describe, expect, it } from "vitest";
import {
  normalizePageNumber,
  normalizeTotalPages,
  pageFallbackAfterMutation,
  toActionErrorMessage,
} from "../app/(protected)/_lib/ui-state";

describe("ui-state helpers", () => {
  it("normalizes page and total-pages values safely", () => {
    expect(normalizePageNumber(3)).toBe(3);
    expect(normalizePageNumber(-2)).toBe(0);
    expect(normalizePageNumber("bad", 2)).toBe(2);

    expect(normalizeTotalPages(5)).toBe(5);
    expect(normalizeTotalPages(0)).toBe(1);
    expect(normalizeTotalPages(undefined)).toBe(1);
  });

  it("returns fallback page after mutating the last item on a page", () => {
    expect(
      pageFallbackAfterMutation({
        requestedPage: 2,
        returnedPage: 2,
        totalPages: 2,
        itemCount: 0,
      }),
    ).toBe(1);

    expect(
      pageFallbackAfterMutation({
        requestedPage: 0,
        returnedPage: 0,
        totalPages: 1,
        itemCount: 0,
      }),
    ).toBeNull();

    expect(
      pageFallbackAfterMutation({
        requestedPage: 1,
        returnedPage: 1,
        totalPages: 2,
        itemCount: 3,
      }),
    ).toBeNull();
  });

  it("maps unknown action errors to a deterministic fallback", () => {
    expect(toActionErrorMessage(new Error("Explicit failure"), "Fallback")).toBe("Explicit failure");
    expect(toActionErrorMessage({ message: "ignored object" }, "Fallback")).toBe("Fallback");
    expect(toActionErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
