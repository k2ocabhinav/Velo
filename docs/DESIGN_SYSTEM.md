# Velo — Design System

> The visual language, theming architecture, animation patterns, and UX standards for all Velo frontends. This is the design source of truth — every component, page, and interaction must conform to this system.

## Aesthetic Direction

**Concept: "Engineered Velocity"**

Velo powers movement. The UI should feel like it's already in motion — purposeful, fast, confident. Not playful (this is B2B infrastructure), not sterile (users spend hours here). The aesthetic sits between **refined utility** and **quiet dynamism**: clean lines, generous spacing, subtle motion that implies speed without being distracting.

**Principles:**
1. **Speed is visible.** Every interaction gives instant feedback. Nothing feels static.
2. **Density is earned.** Admin gets data-dense tables. Rider/driver apps breathe — big touch targets, clear hierarchy.
3. **Brand is a skin, not a surgery.** Theming changes surface (colors, logo, fonts). Layout, spacing, motion, and UX patterns are fixed — they're the platform's quality guarantee.

**What this is NOT:**
- Not Material Design (too Google)
- Not a generic SaaS dashboard (no purple gradients, no Inter everywhere)
- Not skeuomorphic or overly decorative
- Not trendy/disposable — this needs to look current in 3 years

## Typography

**Default stack (Velo platform brand):**

| Role | Font | Weight | Usage |
|---|---|---|---|
| Display | Barlow Condensed | 800, 900 | Page titles, hero numbers, dashboard stats, section headings |
| Body | Inter | 400, 500, 600, 700 | All body text, labels, table content, buttons |
| Mono | JetBrains Mono | 400 | OTPs, ride codes, transaction IDs |

**Why Barlow Condensed + Inter:** Barlow Condensed is a bold condensed sans that creates editorial impact for headlines — uppercase at large sizes, it reads as purposeful infrastructure, not startup playfulness. Inter is the industry-standard UI body font: excellent legibility at all sizes, well-hinted, widely cached by browsers.

**Font loading:** Both fonts are loaded via `next/font/google` in each app's `layout.tsx`. Config constants are in `packages/ui/src/theme/google-fonts.ts` for DRY usage. CSS variables `--font-display` and `--font-body` are set on `<html>` and referenced throughout.

**Tenant override:** Tenants can provide a custom `display` and `body` font URL. If none provided, defaults apply. Mono is never overridden — it's a platform UX decision.

**Scale (fluid, clamp-based):**
```css
--text-xs:   clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem);
--text-sm:   clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem);
--text-base: clamp(0.9rem, 0.85rem + 0.25vw, 1rem);
--text-lg:   clamp(1.05rem, 1rem + 0.25vw, 1.125rem);
--text-xl:   clamp(1.2rem, 1.1rem + 0.5vw, 1.25rem);
--text-2xl:  clamp(1.4rem, 1.2rem + 1vw, 1.5rem);
--text-3xl:  clamp(1.75rem, 1.5rem + 1.25vw, 1.875rem);
--text-4xl:  clamp(2rem, 1.5rem + 2.5vw, 2.25rem);
--text-hero: clamp(2.5rem, 2rem + 3vw, 3.75rem);
```

## Color System

### Token Architecture (3 layers)

```
Layer 1: Primitives (raw HSL values — never used directly in components)
Layer 2: Semantics  (role-based tokens — what components reference)
Layer 3: Component  (specific overrides — rare, only when semantic isn't enough)
```

### Layer 1: Primitive Palette (Velo defaults)

```css
/* Neutral scale — warm gray, not cold */
--gray-50:  210 20% 98%;
--gray-100: 210 15% 95%;
--gray-200: 210 12% 90%;
--gray-300: 210 10% 80%;
--gray-400: 210 8% 65%;
--gray-500: 210 7% 50%;
--gray-600: 210 10% 38%;
--gray-700: 210 12% 27%;
--gray-800: 210 15% 18%;
--gray-900: 210 20% 10%;
--gray-950: 210 25% 5%;

/* Brand — Duotone palette */
--velo-black: #131313;
--velo-white: #fefefe;
--velo-blue: #1A56FF;           /* 226 100% 55% — primary accent */
--velo-blue-hover: #0037D4;
--blue-500: 226 100% 55%;
--blue-600: 226 100% 42%;
--teal-500: 173 58% 39%;
--amber-500: 38 92% 50%;
--red-500: 0 84% 60%;
--green-500: 142 71% 45%;
```

### Layer 2: Semantic Tokens

```css
:root {
  /* Surfaces */
  --color-background:    var(--gray-50);
  --color-surface:       0 0% 100%;
  --color-surface-hover: var(--gray-100);
  --color-surface-active: var(--gray-200);
  --color-elevated:      0 0% 100%;     /* cards, modals */
  --color-overlay:       210 25% 5% / 0.5;

  /* Text */
  --color-foreground:     var(--gray-900);
  --color-muted:          var(--gray-500);
  --color-placeholder:    var(--gray-400);

  /* Brand / Interactive */
  --color-primary:        var(--blue-600);
  --color-primary-hover:  var(--blue-500);
  --color-primary-fg:     0 0% 100%;

  /* Accent (used sparingly — CTAs, active states) */
  --color-accent:         var(--teal-500);
  --color-accent-fg:      0 0% 100%;

  /* Status */
  --color-success:        var(--green-500);
  --color-warning:        var(--amber-500);
  --color-danger:         var(--red-500);
  --color-info:           var(--blue-500);

  /* Borders */
  --color-border:         var(--gray-200);
  --color-border-hover:   var(--gray-300);
  --color-ring:           var(--blue-500) / 0.3;

  /* Shapes */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}

.velo-theme-dark {
  --color-background:    0 0% 7%;     /* #131313 */
  --color-surface:       0 0% 10%;
  --color-foreground:    0 0% 99%;    /* #fefefe */
  --color-muted:         0 0% 53%;
  --color-primary:       226 100% 55%; /* #1A56FF */
  --color-border:        0 0% 100% / 0.10;
}

/* Per-app dark mode via data-theme attribute */
html[data-theme="dark"] {
  /* Each app's globals.css defines dark overrides matching the duotone palette */
}
```

### Dark Mode

Dark mode is supported in admin, rider, and driver apps via:
- `<DarkModeToggle />` component from `@velo/ui/theme`
- `useDarkMode()` hook for programmatic access
- Reads `prefers-color-scheme` on mount for initial value
- Persists user choice to `localStorage` key `velo-theme`
- Toggles `.velo-theme-dark` class and `data-theme` attribute on `<html>`
- Landing page is dark-only by design (no toggle needed)

The duotone palette uses:
- Dark: `#131313` background, `#fefefe` text
- Light: `#fefefe` background, `#131313` text
- Accent: `#1A56FF` (velocity blue) across both modes
```

### Tenant Theming Override

Tenants configure these values only (everything else inherits):

```typescript
interface TenantTheme {
  colors: {
    primary: string;     // HSL: "220 72% 50%"
    accent?: string;     // HSL, optional — falls back to primary
  };
  fonts?: {
    display?: string;    // Google Fonts URL or self-hosted
    body?: string;
  };
  logo: {
    url: string;         // SVG preferred
    height: number;      // px, max 40
  };
  darkMode?: boolean;    // enable dark mode toggle for end users
  borderRadius?: 'sharp' | 'rounded' | 'pill';  // maps to radius scale
}
```

**How it loads:**
1. Next.js middleware detects tenant from subdomain (`acme.velo.app`) or path (`/t/acme`)
2. Server component fetches tenant config from API (cached in Redis, stale-while-revalidate)
3. Theme CSS variables are injected into `<html style="...">` server-side — **no flash of unstyled content**
4. Fonts are preloaded in `<head>` via `next/font` or `<link rel="preload">`

**What tenants CANNOT customize:**
- Layout structure, spacing scale, motion patterns
- Component behavior (hover states, focus rings, accessibility)
- Typography scale (sizes, line heights, letter spacing)
- Shadow system, elevation model

This is intentional. The platform guarantees UX quality. Tenants get brand identity, not design control.

## Motion & Animation

**Library:** Framer Motion (`motion/react`)

**Philosophy:** Motion should communicate state, not decorate. Every animation answers one question: "What just happened?"

### Timing Tokens

```typescript
export const timing = {
  instant:  { duration: 0.1 },
  fast:     { duration: 0.15 },
  normal:   { duration: 0.25 },
  slow:     { duration: 0.4 },
  emphasis: { duration: 0.6 },
} as const;

export const easing = {
  standard:  [0.25, 0.1, 0.25, 1.0],    // general movement
  decelerate: [0.0, 0.0, 0.2, 1.0],      // entering elements
  accelerate: [0.4, 0.0, 1.0, 1.0],      // exiting elements
  spring: { type: 'spring', stiffness: 300, damping: 24 },
} as const;
```

### Page Transitions

```typescript
// packages/ui/src/motion/page-transition.tsx
export const pageVariants = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.25, ease: easing.decelerate } },
  exit:     { opacity: 0, y: -4, transition: { duration: 0.15, ease: easing.accelerate } },
};

// Usage in layout.tsx:
// <AnimatePresence mode="wait">
//   <motion.div key={pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
//     {children}
//   </motion.div>
// </AnimatePresence>
```

### Staggered List Reveals

Data lists, cards, table rows — they don't just appear, they cascade in:

```typescript
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem = {
  initial:  { opacity: 0, y: 12 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.3, ease: easing.decelerate } },
};
```

### Micro-Interactions

| Element | Interaction | Animation |
|---|---|---|
| Button | Press | scale(0.97) for 100ms, spring back |
| Card | Hover | translateY(-2px), subtle shadow increase |
| Toggle | Switch | Spring physics on thumb, background color crossfade |
| Badge | Count change | Scale pop (1.0 → 1.2 → 1.0) with 200ms spring |
| Toast | Enter/Exit | Slide from right + fade, exit slide right + fade |
| Modal | Open | Backdrop fade 200ms, content scale(0.95→1) + fade 250ms |
| Modal | Close | Content fade out 150ms, backdrop fade 200ms |
| Tab | Switch | Underline slides with spring physics, content crossfade |
| Skeleton | Pulse | CSS shimmer gradient, 1.5s ease-in-out infinite |

### Map-Specific Animations

| Element | Animation |
|---|---|
| Driver marker | Smooth interpolation between position updates (CSS transition 1s ease) |
| Route line | Draw-on effect using SVG stroke-dashoffset |
| Pickup/dropoff pins | Drop-in with spring bounce |
| Search radius | Pulsing circle (scale 1→1.3, opacity 1→0, repeat) |

## Loading States

**Rule: No blank screens. Ever.**

Every component that fetches data MUST have a loading state. Three patterns, chosen by context:

### 1. Skeleton Screens (primary pattern)

Used for: page content, cards, tables, lists — anything with a known layout.

```typescript
// packages/ui/src/skeleton.tsx
// Shimmer animation via CSS (no JS overhead):
// background: linear-gradient(90deg, var(--gray-200), var(--gray-100), var(--gray-200))
// background-size: 200% 100%
// animation: shimmer 1.5s ease-in-out infinite

// Every data component exports a .Skeleton variant:
// <RideCard.Skeleton />
// <EarningsTable.Skeleton rows={5} />
// <StatsGrid.Skeleton />
```

Pattern: each component exports its own `Skeleton` — same dimensions, same layout, gray blocks where content will be.

### 2. Inline Spinners

Used for: buttons after click, small async actions (approving a driver, processing a payout).

```typescript
// Button with loading state:
// <Button loading={isPending}>Approve</Button>
// Shows: spinner icon replaces text, button disabled, width preserved
```

### 3. Full-Screen State Indicators

Used for: ride matching ("Finding your driver..."), payment processing, initial app load.

These are **branded moments** — they reinforce the tenant's identity during the wait:

| State | Visual |
|---|---|
| Finding driver | Pulsing radar animation centered on pickup point, "Matching you with a driver nearby..." |
| Payment processing | Horizontal progress bar with indeterminate shimmer, "Processing payment..." |
| App loading | Tenant logo centered, subtle pulse, no text |
| Ride in progress | Live map with driver marker (never a loading screen — always show the map) |

### Optimistic Updates

For instant-feel interactions, update UI before server confirms:

| Action | Optimistic behavior | Rollback on error |
|---|---|---|
| Mark notification read | Immediately dim + decrement badge | Re-highlight + increment badge + toast error |
| Cancel ride | Immediately show "Cancelling..." status | Revert to previous status + toast error |
| Toggle availability | Immediately flip toggle | Flip back + toast "Failed to update" |
| Apply promo code | Show discount in fare breakdown | Remove discount line + toast error |

## Responsive Design

### Breakpoints

```css
--bp-sm:  640px;   /* phone landscape */
--bp-md:  768px;   /* tablet portrait */
--bp-lg:  1024px;  /* tablet landscape / small laptop */
--bp-xl:  1280px;  /* desktop */
--bp-2xl: 1536px;  /* wide desktop */
```

### App-Specific Strategy

| App | Primary target | Layout approach |
|---|---|---|
| Admin | Desktop (xl+) | Desktop-first. Sidebar nav collapses to hamburger at md. Data tables scroll horizontally at sm. |
| Rider | Mobile (sm) | Mobile-first. Bottom sheet navigation. Full-screen map. Cards stack vertically. |
| Driver | Mobile (sm) | Mobile-first. Big touch targets (min 48px). Thumb-reachable primary actions at bottom. |

### Touch Target Rules
- Minimum tap target: 44×44px (Apple HIG)
- Spacing between tappable elements: minimum 8px
- Primary actions (Accept Ride, Start Ride, End Ride): 56px height minimum
- Swipe gestures: only for secondary actions (dismiss notification, archive)

## Spacing & Layout

**4px base grid.** All spacing is a multiple of 4.

```css
--space-0:  0;
--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
```

### Shadow / Elevation System

```css
--shadow-sm:   0 1px 2px hsl(var(--gray-900) / 0.05);
--shadow-md:   0 2px 8px hsl(var(--gray-900) / 0.08);
--shadow-lg:   0 8px 24px hsl(var(--gray-900) / 0.12);
--shadow-xl:   0 16px 48px hsl(var(--gray-900) / 0.16);
--shadow-inner: inset 0 1px 2px hsl(var(--gray-900) / 0.06);
```

| Elevation | Usage | Shadow |
|---|---|---|
| 0 (flat) | Background surface, table rows | none |
| 1 | Cards, inputs | shadow-sm |
| 2 | Dropdowns, popovers | shadow-md |
| 3 | Modals, drawers | shadow-lg |
| 4 | Toast notifications | shadow-xl |

## Accessibility (Non-Negotiable)

- **WCAG 2.1 AA** minimum contrast ratios (4.5:1 text, 3:1 large text/UI)
- All interactive elements keyboard-navigable with visible focus rings
- ARIA labels on icon-only buttons
- `prefers-reduced-motion` respected — disable all non-essential animations
- `prefers-color-scheme` detected for initial dark/light selection
- Screen reader announcements for: toast notifications, ride status changes, loading completion
- Color is never the ONLY indicator of status (always pair with icon or text)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Future-Proofing: Known Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Font flash (FOUT)** | Unstyled text flicker on load | Use `next/font` with `display: swap` + size-adjust fallback |
| **Theme flash** | Default theme shows before tenant theme loads | Inject theme as inline `<style>` in server component — rendered at SSR time, zero client flash |
| **Bundle size creep** | Slow initial load as features grow | Lazy-load: maps (`dynamic()`), charts (`dynamic()`), modals (portals). Route-based code splitting is automatic with Next.js App Router. |
| **Map library weight** | Mapbox GL JS is ~200KB | Load only on map pages via `next/dynamic({ ssr: false })`. Rider/driver only. Admin never loads it. |
| **Stale tenant theme cache** | Tenant changes branding, users see old theme | Redis cache with 5-min TTL + `Cache-Control: stale-while-revalidate`. Admin dashboard has "clear theme cache" button. |
| **RTL languages** | Future tenants may need right-to-left | Use CSS logical properties from day one (`margin-inline-start` not `margin-left`). Tailwind v4 supports `ltr:`/`rtl:` variants. |
| **Low-end devices** | Driver app on cheap Android phones | Test on 2x CPU throttle. No Framer Motion on driver's active ride screen (only CSS transitions). Avoid layout thrashing. |
| **Accessibility lawsuits** | B2B SaaS, especially NEMT vertical, requires WCAG compliance | Build accessible from day one (see section above). Run axe-core in CI. |
| **White-label SSR hydration mismatch** | Server renders default theme, client hydrates with tenant theme | Theme resolved server-side via middleware. No client-side theme switching during hydration. |
| **WebSocket reconnection** | Lost connection during active ride | Exponential backoff in STOMP client. On reconnect, fetch latest state from REST API to reconcile. Visual indicator "Reconnecting..." in status bar. |

## Component Architecture (packages/ui)

### File Structure per Component

```
packages/ui/src/
├── primitives/            # Low-level, unstyled (Radix-based via shadcn)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   └── tooltip.tsx
├── composed/              # Higher-level, app-specific
│   ├── data-table.tsx     # Sortable, paginated table
│   ├── stat-card.tsx      # Dashboard number card with trend
│   ├── status-badge.tsx   # Ride/payout/driver status
│   ├── ride-card.tsx      # Ride summary (used in history lists)
│   ├── notification-bell.tsx
│   ├── empty-state.tsx    # Illustration + message for zero-data
│   └── confirm-dialog.tsx # "Are you sure?" pattern
├── feedback/              # Loading & state communication
│   ├── skeleton.tsx       # Generic shimmer skeleton
│   ├── spinner.tsx        # Inline spinner
│   ├── progress-bar.tsx   # Determinate/indeterminate
│   ├── toast-provider.tsx # Toast container + animations
│   └── error-boundary.tsx # Graceful error fallback
├── motion/                # Animation utilities
│   ├── page-transition.tsx
│   ├── stagger.tsx        # Staggered list wrapper
│   ├── fade-in.tsx        # Simple fade + translate
│   └── presence.tsx       # AnimatePresence wrapper
└── theme/                 # Theming infrastructure
    ├── theme-provider.tsx # Context + CSS variable injection
    ├── tokens.css         # All design tokens
    ├── fonts.ts           # Font loading config
    └── tenant-resolver.ts # Fetch + cache tenant theme
```

### Component Conventions

1. Every data-fetching composed component exports a `.Skeleton` static property
2. Every interactive component supports `disabled` and `loading` props
3. All components use semantic tokens (never primitive colors directly)
4. All components support `className` prop for escape-hatch styling
5. No component imports from `apps/` — dependency flows one direction: `packages/ → apps/`
