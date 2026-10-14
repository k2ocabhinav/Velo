# Landing Page Plan

Status: approved for build (2026-10-15). Source research is kept locally. This plan supersedes the landing sections of `UX_REFINEMENT_PLAN.md`.

## 1. Brief
- **Subject:** Velo, a branded dispatch desk for Indian fleets of 10-50 vehicles running pre-booked business and hotel transfers.
- **Audiences:** (1) fleet owners and operations managers on phones, used to WhatsApp, practical and sceptical; (2) startup-program reviewers who need to see who it's for, what exists and what stage it's at within one screen.
- **Primary job:** show the working product honestly and get a demo booked (form or WhatsApp).
- **Stage line (always visible near the hero):** "Pre-launch. Working demo available."

## 2. Concept: "The morning trip sheet"
Pre-booked transfer work is organised by time: a 05:40 airport pickup, a 09:15 hotel-to-office run, an 18:30 return. The page borrows that vernacular. A day's timeline structures the narrative, and the hero shows one neighbourhood where three booked transfers get dispatched. Times are the only structural markers, because the content really is a sequence.

**The one bold element:** the interactive dispatch neighbourhood in the hero. Everything else is quiet, typographic and product-led.

## 3. Tokens (landing only; extends `tokens.css`, no raw colors in components)
| Name | Hex | Role |
|---|---|---|
| Asphalt | `#1C2230` | Body text, dark band backgrounds, building tops in the scene |
| Dawn | `#F4F6F9` | Page ground (cool, not cream) |
| Signal blue | `#1A56FF` | Primary actions, the selected route |
| Route teal | `#2A9D8F` | Live and in-motion states (moving vehicle, "on trip") |
| Sodium | `#F2A33A` | Time markers and "needs attention" only; sparingly |
| Concrete | `#C9CFD8` | Hairlines, scene streets and buildings, muted UI |

**Type:**
- Barlow Condensed 800 for display: sentence case, `--text-heading-*` scale, leading 0.95-1.0. Never all caps.
- Inter 400/500/600 for everything else, 16-18px body with 1.55 leading, line length ≤ 70ch.
- Times and prices use Inter `font-variant-numeric: tabular-nums`. No monospace labels.

**Avoid:** ALL-CAPS eyebrows, dot-joined meta strings, `→` appended to links, identical rounded cards with soft shadows, gradient washes, fake logos or testimonials, stock photos, "AI-powered", "seamless", "next-generation", "India's leading".

**Shape:** radius 6px on controls, 10px on screenshots; a hairline border instead of shadows (one `--shadow-md` only on the floating trip card).

**Layout:** a left-aligned 12-column grid, max 1200px, side padding `clamp(16px, 4vw, 48px)`, sections spaced `--space-section`.

## 4. Sections
```
[nav] VELO wordmark · How it works · Pricing · FAQ        [Book a demo]
┌─ 1 HERO ────────────────────────────────────────────────────────────┐
│ h1 (left, 6 cols)                       │ dispatch neighbourhood     │
│ subhead                                 │ (3D desktop / SVG mobile)  │
│ [Book a demo] [Watch the 2-min demo]    │ + floating HTML trip card  │
│ Pre-launch. Working demo available.     │ + trip buttons 05:40 09:15 18:30 │
└─────────────────────────────────────────────────────────────────────┘
 2 A morning of transfers — horizontal time axis 05:00→20:00, three sample trips
   as rows: booked → driver assigned → on trip → completed (labelled "Sample day").
 3 Follow one transfer — 5 steps (real sequence): booking, assignment, pickup OTP,
   live tracking, completed record. Desktop: sticky product screenshot that swaps
   per step; mobile: stacked step + screenshot. Real screenshots from docs/images.
 4 Your fleet's name on it — brand switcher: two demo tenants (Velo Business,
   Saffron Routes); a mini HTML mock of the rider booking bar re-themes via CSS
   variables when toggled; real screenshots below, captioned "Demo fleet, sample data".
 5 Getting started — what you need (a browser for dispatch, smartphones for drivers),
   what the founder does with you (set-up call, import drivers, first live day).
 6 Pricing — ₹299 per active vehicle per month, minimum ₹2,990, GST extra.
   Worked example: 15 vehicles = ₹4,485 + GST. "Early-access pilot pricing,
   subject to change." What's included / not yet included.
 7 Founder note — first person, why this niche, the next milestone (first pilot fleets).
   Name, photo and city come from config; the section hides any field that is unset.
 8 FAQ — web app vs native, recurring trips (coming), support hours (IST), how data
   is handled today, hosting status, what a pilot involves.
 9 Book a demo — short form (name, phone/WhatsApp, fleet size, city, preferred time,
   email optional) + "WhatsApp the founder" button + email; next-step copy.
[footer] wordmark, links, Privacy, Terms, "Built in India", © year
```

**Hero copy:**
- h1: "A dispatch desk for pre-booked business and hotel transfers."
- Subhead: "For fleets of 10 to 50 vehicles. Bookings, driver assignments and live trip updates in one web workspace that carries your fleet's name."

**CTAs:** "Book a demo" (primary everywhere); "WhatsApp the founder" (secondary, only if `NEXT_PUBLIC_WHATSAPP_NUMBER` is set); "Watch the 2-minute demo" (only if `NEXT_PUBLIC_DEMO_VIDEO_URL` is set, otherwise "See how it works" anchors to section 3).

**Claims:** only shipped features (check `PROGRESS.md`). Recurring trips, corporate billing, native apps, Hindi, India hosting and WhatsApp integration are "coming" or unmentioned.

## 5. Hero scene (vanilla three r180)
- **Scene:** a deterministic procedural neighbourhood (fixed seed) with about 150 instanced shallow buildings, two hotels and a business park as authored landmarks, and streets as thin ribbons. Six vehicles; three authored routes on street edges. Orthographic isometric camera. Colors resolved from tokens once, re-resolved on theme change.
- **Interaction:** trip buttons (HTML, ≥44px) highlight a route and vehicle and update the HTML trip card. "Preview dispatch" plays one sequence of ≤4 s (assign → route lights → vehicle travels), then settles. Pause and replay are available. Drag tilts ±8° with a "Reset view" button. Page scroll is never captured.
- **Loading:** an inline SVG fallback rendered from the same coordinates is always present and complete. The canvas loads only on ≥1024px with a fine pointer, no reduced motion, no Save-Data, WebGL2 available, after the element is in view and the browser is idle. It's dynamically imported with `ssr:false`, and the SVG stays until the first rendered frame. The canvas is `aria-hidden`; all meaning lives in HTML.
- **Budgets:** extra initial JS ≤ 8 kB gz; deferred three + scene ≤ 200 kB gz; inline SVG ≤ 8 kB gz; ≤ 30 draw calls and ≤ 30k triangles; DPR ≤ 1.5; render on demand (zero frames when settled, hidden or offscreen); LCP element = the h1; CLS = 0.

## 6. Platform
- **Static export:** `output: "export"`, no middleware, build-time branding, no request-time fetches. Netlify `netlify.toml` (build command, publish `apps/landing/out`) and `_headers` generated from `createSecurityHeaders({ environment: "production" })`. No new CSP origins.
- **Remove Lenis** (smooth scroll is decorative and has a RAF cleanup bug). Motion: one hero intro; everything else is user-triggered; reduced motion is respected live, including stopping the RAF loop.
- **SEO:** metadata, OG image (static PNG of the SVG hero), sitemap, robots, canonical from `NEXT_PUBLIC_SITE_URL`. Privacy and Terms pages in plain language, describing only what the form collects.
- **Contact form:** posts to `NEXT_PUBLIC_CONTACT_FORM_ACTION` (Netlify Forms or Formspree), with a mailto fallback to `NEXT_PUBLIC_CONTACT_EMAIL`. Accessible validation; success and error states.

## 7. Build split (file ownership)
| Package | Owns | Contract |
|---|---|---|
| `lp-3d` | `packages/ui/src/landing/dispatch/**` (scene, SVG fallback, controls, eligibility, `sample-trips.ts`), its tests and fallback script | Exports `<DispatchIllustration />` and `SAMPLE_TRIPS` (id, time, pickup, drop-off, driver, status steps) via `@velo/ui/landing` |
| `lp-sections` | `apps/landing/app/sections/**`, `apps/landing/content/**`, `page.tsx` composition, images | Imports `DispatchIllustration` and `SAMPLE_TRIPS`; until lp-3d merges, uses a local placeholder with the same props |
| `lp-platform` | `layout.tsx`, landing `globals.css` tokens, nav, footer, privacy/terms pages, next/netlify config, SEO, form wiring, Lenis removal, landing Playwright and budget tests | Provides tokens and the layout shell; sections render inside it |

## 8. Acceptance (orchestrator-verified)
- Screenshots at 390, 768 and 1440 (light and dark, WebGL and forced SVG, reduced motion) reviewed against this plan.
- axe: 0 serious/critical. Keyboard path through every control.
- The production static export builds; `_headers` present; JS budgets measured from emitted chunks; LCP element = h1 (Playwright `PerformanceObserver`).
- No claim on the page outside `PROGRESS.md`; every CTA works with and without the optional env vars.
