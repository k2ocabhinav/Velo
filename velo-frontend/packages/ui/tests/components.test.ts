import { createElement as h, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AddressSearch,
  AppTopBar,
  BottomNav,
  ConfirmDialog,
  DataTable,
  DateTime,
  DefinitionList,
  EmptyState,
  ErrorState,
  Field,
  Menu,
  Money,
  PageHeader,
  Pagination,
  RouteStrip,
  ReconnectingIndicator,
  Section,
  SegmentedControl,
  Select,
  Sheet,
  StatusBadge,
  StatCard,
  Textarea,
} from "../src";

function html(node: ReactNode): string {
  return renderToStaticMarkup(node as ReactElement);
}

describe("shared UI foundation", () => {
  it("renders a page header with a purpose line and action slot", () => {
    const markup = html(h(PageHeader, { title: "Trips", description: "Review recent trips.", actions: "New trip" }));
    expect(markup).toContain("<h1>Trips</h1>");
    expect(markup).toContain("Review recent trips.");
    expect(markup).toContain("New trip");
  });

  it("renders titled sections with actions and body content", () => {
    const markup = html(h(Section, { title: "Details", actions: "Edit", children: "Section content" }));
    expect(markup).toContain("aria-labelledby");
    expect(markup).toContain("Section content");
    expect(markup).toContain("Edit");
  });

  it("provides composed skeleton variants for data tables, statistics, and sections", () => {
    expect(html(h(DataTable.Skeleton, { rows: 2, columns: 3 }))).toContain('aria-label="Loading results"');
    expect(html(h(StatCard.Skeleton, {}))).toContain('aria-label="Loading statistic"');
    expect(html(h(Section.Skeleton, { rows: 2 }))).toContain('aria-label="Loading section"');
  });

  it("renders a shared reconnecting notice with an optional retry action", () => {
    const markup = html(h(ReconnectingIndicator, {
      state: "reconnecting",
      attempts: 2,
      onRetry: vi.fn(),
    }));
    expect(markup).toContain("Reconnecting… Attempt 2.");
    expect(markup).toContain(">Retry</button>");
  });

  it("wires field hint and error text to an invalid control", () => {
    const markup = html(h(Field, {
      label: "Email address",
      hint: "Use your work email.",
      error: "Enter a valid email.",
      children: h("input", { type: "email" }),
    }));
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="');
    expect(markup).toContain('class="ui-control"');
    expect(markup).toContain("Enter a valid email.");
  });

  it("renders a select control", () => {
    expect(html(h(Select, { children: h("option", { value: "one", children: "One" }) }))).toContain("<select");
  });

  it("renders a textarea control", () => {
    expect(html(h(Textarea, { name: "notes" }))).toContain("<textarea");
  });

  it("renders a labelled segmented radio group with counts", () => {
    const markup = html(h(SegmentedControl, {
      ariaLabel: "Trip status",
      value: "active",
      onValueChange: vi.fn(),
      options: [{ value: "active", label: "Active", count: 3 }, { value: "past", label: "Past" }],
    }));
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain("Active");
    expect(markup).toContain(">3</span>");
  });

  it("renders a closed submit-based address search with a search action", () => {
    const markup = html(h(AddressSearch, {
      label: "Pickup",
      value: "",
      selected: false,
      preSearchLabel: "Saved places",
      preSearchPlaces: [{ label: "Home, Bengaluru", lat: 12.9, lon: 77.5, type: "saved", title: "Home" }],
      search: vi.fn(async () => []),
      onValueChange: vi.fn(),
      onSelect: vi.fn(),
    }));
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('placeholder="Search an address"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain(">Search</button>");
    expect(markup).not.toContain('role="listbox"');
  });

  it("renders a keyboard-enabled overflow menu trigger", () => {
    const markup = html(h(Menu, { items: [{ label: "Cancel trip", onSelect: vi.fn(), destructive: true }] }));
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');
  });

  it("renders destructive confirmation with a verb-labelled action", () => {
    const markup = html(h(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: "Delete rider?",
      description: "This will remove the rider account.",
      confirmLabel: "Delete rider",
      onConfirm: vi.fn(),
    }));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Delete rider");
    expect(markup).toContain('data-variant="danger"');
  });

  it("renders an empty state with its next action", () => {
    const markup = html(h(EmptyState, { title: "No trips yet", description: "Request a trip to see it here.", action: "Request trip" }));
    expect(markup).toContain("No trips yet");
    expect(markup).toContain("Request a trip to see it here.");
    expect(markup).toContain("Request trip");
  });

  it("renders a retry action for an error state", () => {
    const markup = html(h(ErrorState, { title: "Couldn't load trips", onRetry: vi.fn() }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(">Retry</button>");
  });

  it("maps known statuses to plain labels and semantic tones", () => {
    const markup = html(h(StatusBadge, { domain: "ride", status: "ONGOING" }));
    expect(markup).toContain('data-tone="live"');
    expect(markup).toContain("Trip in progress");
  });

  it("renders definition label and value pairs", () => {
    const markup = html(h(DefinitionList, { items: [{ label: "Driver", value: "Ari Singh" }] }));
    expect(markup).toContain("<dt>Driver</dt>");
    expect(markup).toContain("<dd>Ari Singh</dd>");
  });

  it("formats a money value with the shared formatter", () => {
    expect(html(h(Money, { amount: 12.5 }))).toContain("$12.50");
  });

  it("formats a date with the shared formatter", () => {
    expect(html(h(DateTime, {
      value: "2026-04-05T09:05:00.000Z",
      now: new Date("2026-04-05T09:00:00.000Z"),
    }))).toContain("in 5 min");
  });

  it("marks the active bottom navigation item and unread count", () => {
    const markup = html(h(BottomNav, {
      currentPath: "/trips",
      items: [{ href: "/trips", label: "Trips", icon: "trips", badgeCount: 3 }, { href: "/me", label: "Me" }],
    }));
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('aria-label="3 unread"');
    expect(markup).toContain('<svg aria-hidden="true" focusable="false" width="24" height="24"');
  });

  it("renders an application top bar", () => {
    const markup = html(h(AppTopBar, { brand: "Velo", title: "Trips", status: "Live", actions: "Menu" }));
    expect(markup).toContain("Velo");
    expect(markup).toContain("Trips");
    expect(markup).toContain("Menu");
  });

  it("renders an accessible responsive sheet when open", () => {
    const markup = html(h(Sheet, { open: true, onOpenChange: vi.fn(), title: "New trip", description: "Enter trip details.", children: "Form" }));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Enter trip details.");
    expect(markup).toContain("Form");
  });

  it("renders the live route status as an accessible alternative", () => {
    const markup = html(h(RouteStrip, { stage: "arriving" }));
    expect(markup).toContain('aria-label="Driver arriving, step 3 of 5"');
    expect(markup).toContain('data-variant="live"');
    expect(markup).toContain("Pickup");
  });

  it("renders a table with optional row action menu", () => {
    const markup = html(h(DataTable<{ id: number; name: string }>, {
      data: [{ id: 1, name: "Ari" }],
      columns: [{ header: "Name", accessorKey: "name" }],
      getRowKey: (row) => row.id,
      rowActions: () => [{ label: "Deactivate", onSelect: vi.fn(), destructive: true }],
    }));
    expect(markup).toContain("<table class=\"data-table\" aria-label=\"Results\">");
    expect(markup).toContain("Ari");
    expect(markup).toContain('aria-label="More row actions"');
  });

  it("renders no pagination for a single page", () => {
    expect(html(h(Pagination, { page: 1, totalPages: 1, onPageChange: vi.fn() }))).toBe("");
    expect(html(h(Pagination, { page: 2, totalPages: 3, onPageChange: vi.fn() }))).toContain("Page 2 of 3");
  });
});
