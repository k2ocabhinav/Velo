# UX Refinement Plan (admin, rider, driver, landing)

Refine, don't redesign. Keep "Engineered Velocity" (`DESIGN_SYSTEM.md`), the tokens and the fonts, and fix hierarchy, flow and copy.
Basis: screenshots of every page at 1440 (admin) and 390/1280 (rider, driver), taken 2026-10-14.

## 1. What's wrong today (cross-cutting)
1. **Build scaffolding shown to users.** "Phase 1 control center", the "Launch checklist" panel, Redis/cache counters on Dispatch, "Route uses OSRM…", raw lat/long inputs, "Advanced coordinates".
2. **The display font shouts everywhere.** Barlow Condensed 800 on every card title and list name (user names, "Driver approvals", "ASSIGN_REQUEST"), so nothing stands out.
3. **System vocabulary.** Raw enums (`CONFIRMED`, `PENDING`, `ASSIGN_REQUEST`), ids ("Ride #—", "Actor #41"), "Started at Unavailable", "Trip lane", "Entry #1".
4. **Meta crammed into dot-joined strings.** "Rider: X · Driver: Y · Status: Z · Started at … · Created …".
5. **Mobile chrome eats the screen.** A seven-link pill cloud plus status chips plus Logout takes about 250px on every page; a "Booking"/"Wallet" pill eyebrow repeats the active tab.
6. **Everything is a card, and cards nest in cards.** Same radius and shadow at every level; panels without inner padding (Branding).
7. **Errors are vague and duplicated.** "An unexpected error occurred" appears twice under a red banner; there's no retry next to the failed thing.
8. **Passive empty states.** "No estimate yet", "No payment methods found" — none of them say what to do next.
9. **Destructive actions at full weight on every row.** Red "Deactivate" and "Delete rider" sit next to safe actions, with no confirmation.
10. **Formatting.** "4/5/2026, 9:00:00 AM", "$0.00" pills, pagination shown for a single page, money and dates formatted differently on each page.
11. **Landing content is hidden until a scroll reveal fires.** A full-page capture shows empty sections, so reduced-motion, no-JS and crawler views may see nothing.

## 2. Direction (refinement of the existing system)
**Palette (existing tokens, stricter roles).** Ink `#131313` for text; Paper `#F8F9FA` background and `#FFFFFF` surface; Signal blue `#1A56FF` for primary actions only; Route teal `hsl(173 58% 39%)` for *live / in motion* only; Amber `hsl(38 92% 50%)` for *needs action*; Red `hsl(0 84% 60%)` for destructive actions and failures only. Color encodes state, never decoration.

**Type.** Barlow Condensed is reserved for page titles and *key figures* (fare, ETA, totals, stat values). Section and card titles use Inter 600 at `--text-lg`; body Inter 400; JetBrains Mono only for OTPs and references. Sentence case everywhere; no uppercase labels, no eyebrow pills.

**The one bold element: the Route Strip.** A horizontal line from pickup ● to drop-off ●, with the trip's progress drawn along it (requested → driver assigned → arriving → on trip → completed) and the driver as a moving marker while live, in teal. It's used on rider Active trip, driver Ride, admin Dispatch active trips, and statically in trip history rows. Everything around it stays quiet.

**Surfaces.** Three levels only: page (no border), section (surface plus border, `--radius-lg`), and inline row (divider, no box). Never box a box. Shadows only on overlays (menus, sheets, dialogs).

**Navigation.**
```
Rider/driver mobile                 Admin (≥1024px)
┌──────────────────────────┐        ┌─────────┬──────────────────────────────┐
│ VELO        ● Live  🔔 3 │        │ VELO    │ Dispatch          [New trip] │
├──────────────────────────┤        │ Operate │ purpose line                 │
│                          │        │  Dashb. │──────────────────────────────│
│        page content      │        │  Dispat.│                              │
│                          │        │  Sched. │   content                    │
├──────────────────────────┤        │ People  │                              │
│ Book  Trips  Wallet  Me  │        │  Drivers 1                             │
└──────────────────────────┘        │  Users  │                              │
Driver tabs: Home Trips Earnings Me │ Money   │                              │
Desktop: the same tabs in the top bar│ Payouts 1, Revenue, Promos            │
                                    │ Setup: Branding · account menu (theme, sign out) │
```
Scheduled and Promos live under Trips and Account (rider); Notifications is the bell; Logout and theme move to Account / the admin user menu.

## 3. Shared foundation (`packages/ui`, `packages/app-core`) — build first
- **Styles:** one shared `@velo/ui/styles.css` (reset, layout utilities `stack/cluster/grid`, form controls, buttons, badges, tables, sections). Each app's `globals.css` shrinks to app-specific rules only (today about 500 duplicated lines each).
- **Components:** `PageHeader` (title, one-line purpose, primary action slot), `Section` (title, optional actions, body), `Field` (label, control, hint, error, and `aria-describedby` wiring), `Select`, `Textarea`, `SegmentedControl` (tabs and filters), `DataTable` with row actions in an overflow `Menu`, `ConfirmDialog` (destructive, verb-labelled), `EmptyState` (what + next action), `ErrorState` (what failed + Retry), `StatusBadge` (enum → plain label + tone map, one source of truth), `DefinitionList` (label/value rows instead of dot strings), `Money`, `DateTime` (relative under 24h, else "5 Apr, 09:00"), `BottomNav`, `AppTopBar`, `Sheet` (mobile bottom sheet), `RouteStrip`.
- **Formatting:** `formatMoney(amount, currency)` from the tenant config (default USD until a tenant currency field exists) and `formatDateTime` in `app-core`. No page formats by hand.
- **Pagination** hides when there's a single page.

## 4. Per-page changes
### Admin
- **Dashboard:** remove "Launch checklist" and "Phase 1". Top row has four KPIs, each a link to its page. Below: a "Needs attention" list (driver approvals, payouts, inactive promos) with counts and a direct action. Move Ops health into a compact status row ("All systems normal" or the specific degraded item).
- **Dispatch:** lead with the live view: *Pending requests* and *Active trips* side by side, each row showing a `RouteStrip`, the rider, the driver and a relative time, with Reassign / Cancel (confirm) in a row menu. "New trip" opens a side `Sheet` with address fields plus a map pick; lat/long goes behind "Enter coordinates". Audit trail becomes a table (time, who, action in plain words, trip). Redis/cache move to Dashboard status.
- **Drivers:** a `SegmentedControl` with counts (Pending 1 / Active 3 / Suspended 0) and a table (name, vehicle, applied, rating, status). Approve is primary; Reject asks for a reason in a confirm dialog.
- **Users:** a table with search and a role filter; row actions (Deactivate, Make driver, Delete) in a menu; Delete goes through a confirm. "Create rider" is the PageHeader action, not a full-width bar.
- **Payouts, Promo codes, Scheduled rides:** tables with status filters, `Money` and `DateTime`, confirm on reject/deactivate, and empty states with a next step.
- **Revenue:** add a 30-day daily bar chart under the three KPIs, plus the top drivers by earnings. If there's no data, say so plainly and link to Dispatch.
- **Branding:** two columns: the form in sections (Identity, Labels, Dispatch mode) on the left, a live preview of the rider top bar and a button on the right. A color picker plus a hex field with validation; a logo URL with a preview.

### Rider
- **Book (home):** map-first. A full-bleed map with a `Sheet` holding "Pickup" and "Where to?" fields (search, current location, or tap the map), then the fare estimate as a key figure, payment and promo as a compact row, and "Request trip" as the single primary button. When a trip is active, a banner at the top links to it. Remove "Latest estimate", "Latest trip request" and "Trip lane" cards.
- **Active trip:** the `RouteStrip` hero with the status in words ("Driver arriving in 4 min"), the driver card (name, vehicle, plate, rating), the OTP in mono, the map with Follow toggle, and Cancel (confirm). One clear degraded-mode notice: "Live updates paused, refreshing every 15 s" with a Retry.
- **Trips:** segmented Upcoming / Past. Rows have a static `RouteStrip`, date, `Money` and status; rating is inline stars after a completed trip.
- **Wallet:** balance as a key figure, saved methods list with a default marker, and "Add method" in a `Sheet` with card fields grouped and validated.
- **Promos, Scheduled, Notifications:** consistent rows and empty states with actions ("Schedule a trip").
- **Login/Register:** brand mark above the form, labels and errors via `Field`, password visibility toggle, register link as a secondary button.

### Driver
- **Home:** the availability toggle as a large switch at the top ("You're online" / "Go online"); incoming requests as large cards with pickup distance, fare and Accept / Decline; the current trip as a `RouteStrip` card with the single next action ("Arrived at pickup", "Start trip", "Complete trip"). Remove the Shortcuts card, which duplicates the nav.
- **Ride [id]:** the map with Follow, the `RouteStrip`, a big next-action button, OTP entry with large digits, and call/navigate links.
- **Earnings:** a period `SegmentedControl` (Today / Week / Month) and the net figure as a key figure with gross and commission below; Request payout in a `Sheet` with an amount defaulting to the available balance; payout history and earning entries as tables with `StatusBadge`.
- **Trips, Notifications, Login/Register:** same patterns as rider.

### Landing
- Content visible by default; reveal animations only enhance and respect reduced motion. Check portal links and the "Request demo" CTA target.

## 5. Copy rules
Plain verbs and sentence case. Buttons name the outcome ("Approve driver", "Request payout"), and the toast repeats it ("Driver approved"). Errors say what failed and what to do ("Couldn't load trips. Retry"), never just "unexpected error". Empty states invite the next action. No ids in user-facing text except trip references in mono.

## 6. Delivery
| Phase | Scope | Owner |
|---|---|---|
| UI-0 | Foundation (§3) plus migrating each app's `globals.css` to the shared styles | executor, then orchestrator review |
| UI-1 | Admin pages | executor (parallel) |
| UI-2 | Rider pages | executor (parallel) |
| UI-3 | Driver pages | executor (parallel) |
| UI-4 | Auth screens, landing, cross-app polish, a11y pass | orchestrator |

**Acceptance per phase.** Before/after screenshots at 390/1280/1440 reviewed by the orchestrator; lint, typecheck, unit, contract tests and build green; Playwright e2e green (selectors updated, behaviour unchanged); keyboard path through each primary flow; visible focus; WCAG AA contrast; reduced motion respected; no raw colors (tokens only); no raw enums or ids in UI text.
