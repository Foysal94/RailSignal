# ADR 0006: Frontend Visual Design System & UI Architecture (Clean Transit Radar)

## Status
Accepted

## Context
RailSignal is an early-warning closure radar for London weekend commuters. The frontend client must provide an immediate, accessible, and high-contrast view of weekend rail health without burying closures behind complex menus or forcing users to scroll past 19 identical cards of normal service.

Additionally, as a senior portfolio project, the UI must give evaluators immediate access to both the persistent weekly alert subscription and the instant on-demand demo trigger (`POST /api/demo/send-test-digest`).

## Decision
Adopt **Option 1: Clean Transit Radar (Concept A with Dual Action Bar)** as the official frontend design system:

1. **Visual Theme & Color Tokens**:
   * **Background**: Deep slate/navy dark mode (`#0B0F19`).
   * **Cards**: High-contrast slate containers (`#111827`) with subtle border styling (`border-slate-800`).
   * **TfL Line Accents**: Thick left accent border using canonical TfL hex colors:
     * Bakerloo: `#B36305`
     * Central: `#E32017`
     * Circle: `#FFD300`
     * District: `#00782A`
     * Hammersmith & City: `#F3A9BB`
     * Jubilee: `#A0A5A9`
     * Metropolitan: `#9B0056`
     * Northern: `#000000` (wrapped in a 1px `border-neutral-500` outline for dark-mode contrast)
     * Piccadilly: `#003688`
     * Victoria: `#0098D4`
     * Waterloo & City: `#95CDBA`
     * Elizabeth line: `#6950A1`
     * London Overground: `#EE7C0E`
     * DLR: `#00A4A7`
   * **Status Badges**:
     * `Planned Closure`: Red (`bg-red-950/80 text-red-300 border border-red-800`).
     * `Part Closure`: Amber (`bg-amber-950/80 text-amber-300 border border-amber-800`).
     * `Good Service`: Emerald (`bg-emerald-950/80 text-emerald-300 border border-emerald-800`).

2. **Header & Dual Action Bar**:
   * **Branding**: RailSignal logo and subtitle *"Weekend Closure Radar"*.
   * **Temporal Window Badge**: Clear indicator displaying `"This Weekend: Friday 19:00 - Monday 04:30 London Time"`.
   * **Dual Top-Right CTAs**:
     * Primary CTA: `[Send Test Alert]` (solid blue accent `#2563EB`) triggering `TestAlertModal` for instant demo alerts.
     * Secondary CTA: `[Friday Alerts]` (outline button) triggering `SubscriptionModal` for weekly digests.

3. **Information Architecture & Sorting**:
   * Single-column vertical stream.
   * **Disruptions First**: Lines with `Planned Closure`, `Part Closure`, or `Part Suspended` automatically sort to the top with visible corridor disruption text (*"No service between Victoria and Brixton"*).
   * **Normal Service Below**: Lines with `Good Service` appear below with clean status pills, eliminating the need to hunt for disruptions.

4. **Component Primitives & Accessibility**:
   * Modals built with `@radix-ui/react-dialog` for focus trapping, keyboard navigation (`Escape` to close), and screen reader accessibility.
   * All touch targets meet the `min-h-[44px]` threshold for mobile ergonomics.
   * Server state managed by TanStack Query v5 with loading skeletons gated on `isFetching`.

## Consequences
* High cognitive clarity: commuters see all disruptions in under 2 seconds.
* Instant portfolio verification: hiring managers can trigger test emails in 1 click.
* Zero contrast bugs: Northern Line is clearly visible on dark backgrounds.
* Accessible, responsive, and mobile-friendly.
