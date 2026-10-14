import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DriverAccountPage from "../app/me/page";
import DriverNotificationsPage from "../app/notifications/page";
import DriverRidesPage from "../app/rides/page";

describe("driver page loading states", () => {
  it("shows skeletons while trips, notifications, and profile are loading", () => {
    const trips = renderToStaticMarkup(createElement(DriverRidesPage));
    const notifications = renderToStaticMarkup(createElement(DriverNotificationsPage));
    const account = renderToStaticMarkup(createElement(DriverAccountPage));

    expect(trips).toContain('aria-label="Loading trips"');
    expect(notifications).toContain('aria-label="Loading notifications"');
    expect(account).toContain('aria-label="Loading your profile"');
    expect(trips).toContain("motion-safe:animate-pulse");
    expect(notifications).toContain("motion-safe:animate-pulse");
    expect(account).toContain("motion-safe:animate-pulse");
  });
});
