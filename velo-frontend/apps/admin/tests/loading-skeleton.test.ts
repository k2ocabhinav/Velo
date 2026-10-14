import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PayoutsPage from "../app/(protected)/payouts/page";
import UsersPage from "../app/(protected)/users/page";

describe("admin data page loading states", () => {
  it("renders user list skeletons while users load", () => {
    const markup = renderToStaticMarkup(createElement(UsersPage));

    expect(markup).toContain('aria-label="Loading users"');
    expect(markup).toContain("motion-safe:animate-pulse");
  });

  it("renders payout list skeletons while payouts load", () => {
    const markup = renderToStaticMarkup(createElement(PayoutsPage));

    expect(markup).toContain('aria-label="Loading payouts"');
    expect(markup).toContain("motion-safe:animate-pulse");
  });
});
