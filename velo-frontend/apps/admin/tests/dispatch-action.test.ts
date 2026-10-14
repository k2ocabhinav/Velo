import { describe, expect, it, vi } from "vitest";
import { executeDispatchOperation } from "../app/_lib/dispatch-action";

describe("dispatch form action result", () => {
  it("reports success only after the dispatch request completes", async () => {
    const resetForm = vi.fn();
    const result = await executeDispatchOperation(async () => undefined);

    if (result.ok) resetForm();

    expect(result).toEqual({ ok: true });
    expect(resetForm).toHaveBeenCalledOnce();
  });

  it("preserves the form when the dispatch request fails", async () => {
    const resetForm = vi.fn();
    const failure = new Error("Dispatch unavailable");
    const result = await executeDispatchOperation(async () => {
      throw failure;
    });

    if (result.ok) resetForm();

    expect(result).toEqual({ ok: false, error: failure });
    expect(resetForm).not.toHaveBeenCalled();
  });
});
