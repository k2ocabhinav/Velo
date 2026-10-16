# Landing Page Plan

Status: approved for build (2026-10-15). Source research is kept locally. This plan supersedes the landing sections of `UX_REFINEMENT_PLAN.md`.

## 1. Brief
- **Subject:** Velo, a branded dispatch desk for fleets of 10-50 vehicles running pre-booked business and hotel transfers, for markets worldwide (India, Europe, the Americas and beyond).
- **Audiences:** (1) fleet owners and operations managers anywhere, often on phones, practical and sceptical; (2) startup-program reviewers who need to see who it's for, what exists and what stage it's at within one screen.
- **Markets:** global. Sample places are generic (airport, Grand Hotel, business park), times are 24-hour, and copy is free of country-specific assumptions. "Built in India" stays in the footer as the origin.
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
 6 Pricing — per active vehicle per month with a currency switch (USD default by
   browser locale; USD/EUR/INR): $5 / €5 / ₹299, minimum $49 / €49 / ₹2,990, local
   taxes extra. Worked example for 15 vehicles. "Early-access pilot pricing,
   subject to change." What's included / not yet included.
 7 Founder note — first person, why this niche, the next milestone (first pilot fleets).
   Name, photo and city come from config; the section hides any field that is unset.
 8 FAQ — web app vs native, recurring trips (coming), support hours (by arrangement across time zones), how data
   is handled today, hosting status, what a pilot involves.
 9 Book a demo — short form (name, phone/WhatsApp, fleet size, city, preferred time,
   email optional) + "WhatsApp the founder" button + email; next-step copy.
[footer] wordmark, links, Privacy, Terms, "Built in India", © year
```

**Hero copy:**
- h1: "A dispatch desk for pre-booked business and hotel transfers."
- Subhead: "For fleets of 10 to 50 vehicles, anywhere. Bookings, driver assignments and live trip updates in one web workspace that carries your fleet's name."

**CTAs:** "Book a demo" (primary everywhere); "WhatsApp the founder" (secondary, only if `NEXT_PUBLIC_WHATSAPP_NUMBER` is set); "Watch the 2-minute demo" (only if `NEXT_PUBLIC_DEMO_VIDEO_URL` is set, otherwise "See how it works" anchors to section 3).

**Claims:** only shipped features (check `PROGRESS.md`). Recurring trips, corporate billing, native apps, Hindi, region-specific hosting and WhatsApp integration are "coming" or unmentioned.

## 5. Hero scene (vanilla three r180)
- **Scene:** a deterministic procedural neighbourhood (fixed seed) with about 150 instanced shallow buildings, two hotels and a business park as authored landmarks, and streets as thin ribbons. Six vehicles; three authored routes on street edges. Orthographic isometric camera. Colors resolved from tokens once, re-resolved on theme change.
- **Interaction:** trip buttons (HTML, ≥44px) highlight a route and vehicle and update the HTML trip card. "Preview dispatch" plays one sequence of ≤4 s (assign → route lights → vehicle travels), then settles. Pause and replay are available. Drag tilts ±8° with a "Reset view" button. Page scroll is never captured.
- **Loading:** an inline SVG fallback rendered from the same coordinates is always present and complete. The canvas loads only on ≥1024px with a fine pointer, no reduced motion, no Save-Data, WebGL2 available, after the element is in view and the browser is idle. It's dynamically imported with `ssr:false`, and the SVG stays until the first rendered frame. The canvas is `aria-hidden`; all meaning lives in HTML.
- **Budgets:** extra initial JS ≤ 8 kB gz; deferred three + scene ≤ 200 kB gz; inline SVG ≤ 8 kB gz; ≤ 30 draw calls and ≤ 30k triangles; DPR ≤ 1.5; render on demand (zero frames when settled, hidden or offscreen); LCP element = the h1; CLS = 0.

## 6. Platform
- **Static export:** `output: "export"`, no middleware, build-time branding, no request-time fetches. Netlify `netlify.toml` (build command, publish `apps/landing/out`) and `_headers` generated from `createSecurityHeaders({ environment: "production" })`. No new CSP origins.
- **Remove Lenis** (smooth scroll is decorative and has a RAF cleanup bug). Motion: one hero intro; everything else is user-triggered; reduced motion is respected live, including stopping the RAF loop.
- **SEO:** metadata, OG image (static PNG of the SVG hero), sitemap, robots, canonical from `NEXT_PUBLIC_SITE_URL`. Privacy and Terms pages in plain language, describing only what the form collects.
- **Contact form:** posts same-origin to `/_velo/contact`, which Netlify rewrites to the provider in `NEXT_PUBLIC_CONTACT_FORM_ACTION` (Netlify Forms or Formspree), with a mailto fallback to `NEXT_PUBLIC_CONTACT_EMAIL`. Accessible validation; success and error states.

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

## 9. Elevation round (v2): "From pre-dawn to dusk"
The page follows a day of transfers, and its colours follow the time of day: the hero is pre-dawn, the sections move through morning and daylight, and the contact area and footer are dusk. Colour carries meaning, which is what makes the page rich rather than decorative.
- **Hero (pre-dawn, full-bleed):** a dark night-sky ground (`#0E1524` → Asphalt) with a low dawn horizon glow (Sodium → soft rose `#F4A6A0` → Signal blue) in the lower right. The 3D neighbourhood is large and unboxed, bleeding off the right edge. Buildings are deep navy with lit window bands in sodium; streets are dim slate; routes are glowing ribbons (a wide additive halo under a crisp core) in Signal blue (selected) and teal (others); vehicles carry a soft headlight halo. A short intro camera drift (≤ 4 s), then still. Light text, with the trip card as a translucent panel and the trip buttons as a slim "dispatch ticker" under the scene. The mobile SVG fallback uses the same night palette.
- **Sunrise transition:** a tall gradient band (night → sodium/rose haze → Dawn) carries the hero into the light sections. No hard edge.
- **Time spine (desktop ≥ 1200px):** a thin route line in the left gutter linking the sections, with time stops (05:40, 09:15, 13:00, 18:30, 21:00) and a marker that follows scroll position (CSS scroll-driven animation where supported, otherwise static). Hidden on smaller screens; static under reduced motion.
- **Section tints:** morning (Dawn with a warm top wash), midday (pure surface `#FFFFFF` panels), afternoon (cool slate tint), dusk (Asphalt with sodium accents) for the founder note, contact and footer.
- **Product shots in frames:** a laptop frame for dispatch and a phone frame for rider and driver, with soft coloured shadows (blue/teal at 20% alpha) and a slight perspective tilt that flattens on hover or focus (CSS only; none under reduced motion).
- **"What you can verify today" strip (true facts only):** automated backend tests, end-to-end tests including accessibility checks, two branded demo tenants, a public decision log. The numbers come from one config constant, which must be kept accurate.
- **Pricing card:** an elevated surface with a thin gradient border (blue → teal), the price as the key figure, and a currency switch.
- **Micro-interactions:** button hover lift of 1px, focus rings, an FAQ open animation (≤ 200 ms, none under reduced motion).
- **Budgets are unchanged** (initial JS, deferred scene ≤ 200 kB gz, LCP = h1, CLS 0, axe 0 serious). The glow is done with extra geometry layers and additive blending; no post-processing or bloom passes.

## 10. Visual direction v3 — "Livery"

**Diagnosis.** The v2 hero (pre-dawn navy + additive blue glow, glass panel, radial nebula) is the exact "AI slop" cluster: distributional convergence on dark-navy-and-neon behind a centered, blurred card, with decorative gradients doing no work. **The fix is polarity, not polish — a light-first, type-led, inked document rooted in the paper and signage of chauffeured transfers, with its one dark moment earned at the end of the day.** Every choice below is also a decision against a named tell.

### 10.1 Concept
The page is a chauffeur company's printed day at the dispatch desk: warm document paper, dense black ink, tabular times, cartographic route linework and the real paper artefacts of the job (docket, voucher, ticket stub, stamp), with one livery colour carrying the meaning. Light-first by default — the page is the bright desk and only turns to a warm ink-black "night shift" for the founder note, contact and footer, so the single dark moment reads as a turn of the day, not a default skin.

### 10.2 Palette (landing layer only; extends `tokens.css`, no raw colours in components)
"Day" is the default theme; "Night" is `[data-theme="night"]`.

**DAY — "the desk in daylight"**
| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--landing-paper` | `#F4F1E9` | Page ground (warm tinted neutral, hue ≈ 42°) | — |
| `--landing-card` | `#FCFBF7` | Raised document surface | separation by rule, not shadow |
| `--landing-ink` | `#16181B` | Body / heading text | 15.8:1 on paper ✓ AAA |
| `--landing-ink-muted` | `#4E5257` | Secondary text | 7.0:1 ✓ AAA |
| `--landing-rule` | `#D8D2C4` | Hairlines, table rules | 1.3:1 — decorative only |
| `--landing-border-ui` | `#8A8577` | Meaningful borders / inputs | 3.3:1 ✓ 1.4.11 |
| `--landing-livery` | `#1E5240` | The one accent: primary action + live / on-trip | 8.0:1 text; white on it 9.0:1 ✓ |
| `--landing-livery-hover` | `#163F31` | Pressed / hover | — |
| `--landing-signal` | `#C2401F` | Time markers + needs-attention **only** | 4.6:1 ✓ AA |
| `--landing-signal-ink` | `#9C2F12` | Signal as small text | 6.6:1 ✓ AA |

**NIGHT — "the desk after dark" (warm ink-black, never navy)**
| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--landing-paper` | `#14120F` | Ground (warm ink-black) | — |
| `--landing-card` | `#1F1C17` | Raised surface (dark elevation goes *lighter*) | — |
| `--landing-ink` | `#F3EFE6` | Text (warm off-white, not `#fff`) | 16.3:1 ✓ AAA |
| `--landing-ink-muted` | `#B0AA9C` | Secondary text | 8.1:1 ✓ AAA |
| `--landing-rule` | `rgba(243,239,230,.14)` | Hairlines | decorative |
| `--landing-border-ui` | `#8C8370` | Borders / inputs | 5.0:1 ✓ |
| `--landing-livery` | `#6FC29B` | Accent lightened so the one hue survives dark | 8.8:1; `#14120F` on it 8.8:1 ✓ |
| `--landing-livery-hover` | `#8AD3AE` | Pressed / hover | — |
| `--landing-signal` | `#E8A552` | Signal = the sodium streetlight, night's one warm mark | 8.8:1 ✓ |
| `--landing-signal-ink` | `#E8A552` | (already ≥ 4.5 on dark) | — |

Accent and signal are **semantic, never decorative**: livery green = action and "on trip"; vermilion / sodium = time markers and "needs attention"; never the sole state cue (always paired with a label or position). Teal-style fills take dark ink, not white.

### 10.3 Scene tokens (`--dispatch-*`)
The 3D scene and its SVG fallback read these. **The default becomes the day set and `[data-theme="night"]` overrides — the current code is inverted, so flip it.**

```css
/* DAY — a bright, inked neighbourhood on paper */
--dispatch-ground:    #F4F1E9;
--dispatch-street:    #D8D2C4;
--dispatch-lane:      #FCFBF7;
--dispatch-building:  #E4DFD3;
--dispatch-roof:      #CFC8B8;
--dispatch-window:    #A9B3AC;
--dispatch-vehicle:   #16181B;
--dispatch-route:     #1E5240;   /* selected */
--dispatch-route-alt: #5E8574;   /* other routes */
--dispatch-ink:       #16181B;
--dispatch-ink-muted: #4E5257;
--dispatch-surface:   rgb(252 251 247 / 0.9);
--dispatch-line:      rgb(22 24 27 / 0.16);
--dispatch-sky-light: #FFFFFF;
--dispatch-key-light: #FFF6E4;
--dispatch-sodium:    #C2401F;   /* assign / attention flash */
--dispatch-glow:      0.25;
--dispatch-halo:      0.05;

/* NIGHT — warm ink-black, sodium lamps, no blue */
--dispatch-ground:    #14120F;
--dispatch-street:    #2A2620;
--dispatch-lane:      #3B362D;
--dispatch-building:  #221E18;
--dispatch-roof:      #332D24;
--dispatch-window:    #E8A552;   /* lit windows = sodium, never blue */
--dispatch-vehicle:   #F3EFE6;
--dispatch-route:     #6FC29B;
--dispatch-route-alt: #4E7A66;
--dispatch-ink:       #F3EFE6;
--dispatch-ink-muted: #B0AA9C;
--dispatch-surface:   rgb(20 18 15 / 0.8);
--dispatch-line:      rgb(243 239 230 / 0.2);
--dispatch-sky-light: #6E6A5F;
--dispatch-key-light: #FFE6BE;
--dispatch-sodium:    #E8A552;
--dispatch-glow:      1;
--dispatch-halo:      0.22;
```

### 10.4 Typography
**Keep Barlow Condensed 800 + Inter — no swap.** Barlow Condensed is the printed-timetable voice the concept needs, and changing a face to chase novelty is itself a slop tell; the leverage is scale and placement, not a new family.
- Display: Barlow Condensed 800, sentence case, tracking −0.03em, leading 0.9, pushed to **type-as-image** — hero numerals / times up to `clamp(4rem, 11vw, 10rem)`.
- Kickers and the arrivals-board cells also use the condensed face, so **Inter is confined to body / UI** (kills the "Inter at every size" tell).
- Body: Inter 400/500/600, 17–18px, leading 1.6, measure ≤ 68ch.
- Times, prices and stub numbers: `font-variant-numeric: tabular-nums` (no monospace labels).

### 10.5 Texture & illustration devices
- **Letterpress grain:** one inline `feTurbulence` SVG noise as a data-URI, `opacity .05`, `mix-blend-mode: multiply` (day) / `soft-light` (night), static — the highest-ratio anti-slop fix, killing the plastic AI smoothness.
- **Halftone:** a fine dot mask (`radial-gradient` tile) at low opacity over the hero map and as section dividers — print-manifest material, cheap and tactile.
- **Cartographic linework:** routes as ink linework with a **legend key** (selected / live / time marker), a **scale bar**, coordinate ticks and dashed "planned" vs solid "driven" strokes — cartography is an underexploited idiom where the map carries meaning, not decoration.
- **Ticket / docket / voucher motifs:** perforated edges (dashed rule + notch), stub numbers, a carbon-copy rule block, an outlined "voucher" for the secondary CTA, and a small rubber-stamp "Pre-launch" seal — the real paper artefacts of the job.
- **Arrivals-board treatment:** the trip buttons and time axis render as split-flap cells (tabular, hairline cell grid); the one authored moment flips them.

### 10.6 Hero composition
- **Light paper ground**, asymmetric 12-col: h1 spans cols 1–7 as oversized type; the stage line is a **stamped job ticket**, kept in the top 40% with both CTAs.
- CTAs: primary = solid **livery** fill; secondary = outlined **voucher**. Delete the coloured glow shadows and the glass "stage" pill.
- The neighbourhood is an **inked map**, not an unboxed glow: it bleeds off the right edge (cols 6→13 + negative inline margin) on the paper ground, with a scale bar and "Sample day" caption at its base; a right-aligned **legend key** replaces the glass card's chrome.
- The trip card becomes a **docket**: perforated top edge, stub number, tabular time, status steps as a small ordered list, pinned overlapping the map at col 4 — not a blurred panel bottom-right.
- Trip buttons = **arrivals-board cells** in one row beneath the map. Delete the orbit rings, the radial star / nebula gradients and the backdrop-blur glass.

### 10.7 Section rhythm & background treatment
- Ground is **paper**; use `--landing-card` only where the content is literally a document (pricing = a **price docket**, "What you can verify today" = a **stamped certificate**). Sections are separated by **full-width hairlines**, never by identical rounded cards or stacked shadows.
- Vary heights and column spans; one full-bleed asymmetric escape (the map). Avoid the three-equal-cards grid.
- The "morning trip sheet" becomes real **data-viz**: a stacked timeline bar per trip (booked → assigned → on-trip → completed) with idle gaps visible.
- **One dark moment only:** founder note + contact + footer on night-shift `#14120F` with sodium marks — roughly the last eighth of the page, so the dark is earned, not the default.
- Product shots: flat ink-hairline frames (no blue / teal glow shadows) with light grain; `content-visibility:auto` below the fold.

### 10.8 Motion signature — "the stamp and the draw"
- **One language:** `--ease-out-expo: cubic-bezier(.16,1,.3,1)` and three durations (160 / 320 / 640ms) reused everywhere.
- Reveals = route **draw-on** (`stroke-dashoffset`) + a 4px ink-rise fade; **nothing slides in from the periphery**.
- **The one authored moment:** the hero dispatch — assign stamp → route draws → car travels → docket stamps "On trip" (≤ 4s, plays once, then settles; the RAF loop stops).
- Press / hover: `scale(.98)` press + 1px lift; FAQ open ≤ 180ms. All disabled under reduced motion.

### 10.9 Concrete CSS / component changes
1. `layout.tsx`: default `data-theme="day"` (light-first); pre-paint theme script unchanged.
2. `globals.css`: swap the palette tokens for the v3 set; body / ground → paper; focus ring → livery; `.section-dark` → `.section-night` (warm ink-black `#14120F`); borders via `--landing-rule` hairlines; add the grain + halftone data-URI utilities.
3. `theme.css`: header = paper with a bottom rule by default; night header uses `#14120F`; drop the translucent navy blur.
4. `Hero.module.css`: delete the nebula / star radial gradients, orbit rings and coloured glows; add paper ground + grain + halftone; h1 to type-as-image scale; docket + arrivals-board styles.
5. `Hero.tsx`: stage line as a stamped ticket; facts list → legend key; add the scale-bar caption.
6. `sections.module.css`: rule-separated paper sections; `.priceCard` gradient border → perforated price docket; `.verifySection` gradient top border → certificate rule; remove `backdrop-filter` glass; flatten device frames (hairline + paper shadow).
7. `dispatch.module.css`: new `--dispatch-*` day / night values (§10.3); trip card → docket; remove backdrop-blur; reduce the route halo.
8. `scene/DispatchCanvas.tsx`: palette reads the new tokens; warm sky / key lights (no blue); day becomes the default palette; windows sodium only at night; delete `computeVertexNormals()` on the Basic ribbon; budgets unchanged (≤ 30 calls, LCP = h1, CLS 0).
9. `DispatchFallback.tsx`: same tokens; condensed map labels; add the legend + scale-bar group.

### 10.10 Anti-slop checklist (one decision against one tell)
| Slop tell | v3 answer |
|---|---|
| Dark navy + neon blue glow | Light paper-first; warm ink-black only for the earned night band |
| Purple / indigo / blue gradient | No decorative gradients; grain + halftone instead |
| Glassmorphism / backdrop-blur cards | Flat paper dockets with hairlines; no blur |
| Identical rounded cards, uniform shadows | Rule-separated rows, varied spans and heights, one shadow (the docket) |
| Centered hero + two buttons + three equal cards | Asymmetric editorial grid, type-led hero, timeline data-viz |
| Inter at every size | Inter for body only; Barlow Condensed carries display, kickers and board cells |
| Decorative gradients, abstract 3D blobs | Cartographic meaning: legend, scale bar, route linework |
| Emoji / line-icon soup, fake logos | Text + rules + the map; no invented proof |
| Copy in threes, "seamless / elevate" | Real trip names, times and stage; copy unchanged from §4 |
| Missing states | Every control keeps focus / pressed / disabled / reduced-motion paths |
