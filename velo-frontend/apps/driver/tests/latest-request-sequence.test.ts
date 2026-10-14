import { describe, expect, it } from "vitest";
import { LatestRequestSequence } from "../app/_lib/latest-request-sequence";

describe("earnings request sequence", () => {
  it("only accepts the newest period response", () => {
    const requests = new LatestRequestSequence();
    const dailyRequest = requests.next();
    const monthlyRequest = requests.next();

    expect(requests.isCurrent(dailyRequest)).toBe(false);
    expect(requests.isCurrent(monthlyRequest)).toBe(true);
  });

  it("invalidates outstanding responses when the page unmounts", () => {
    const requests = new LatestRequestSequence();
    const request = requests.next();

    requests.invalidate();

    expect(requests.isCurrent(request)).toBe(false);
  });
});
