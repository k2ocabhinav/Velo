import { describe, expect, it } from "vitest";
import { isActionPending, setActionPending, toAsyncErrorMessage } from "../src/async-actions";

describe("async action helpers", () => {
  it("tracks per-action pending keys", () => {
    const first = setActionPending({}, "user:1:toggle", true);
    expect(isActionPending(first, "user:1:toggle")).toBe(true);

    const second = setActionPending(first, "user:2:toggle", true);
    expect(isActionPending(second, "user:1:toggle")).toBe(true);
    expect(isActionPending(second, "user:2:toggle")).toBe(true);

    const cleared = setActionPending(second, "user:1:toggle", false);
    expect(isActionPending(cleared, "user:1:toggle")).toBe(false);
    expect(isActionPending(cleared, "user:2:toggle")).toBe(true);
  });

  it("maps unknown errors to safe fallback strings", () => {
    expect(toAsyncErrorMessage(new Error("Request failed"), "fallback")).toBe("Request failed");
    expect(toAsyncErrorMessage({}, "fallback")).toBe("fallback");
  });
});
