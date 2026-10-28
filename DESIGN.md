---
name: LUSTRE Sales Intelligence
description: Premium executive analytics dashboard for a diamond wholesaler — calm, restrained, trade-literate.
colors:
  accent: "#2f4fe0"
  accent-dark: "#2440c4"
  accent-bg: "#eef2fe"
  accent-border: "#d8e0fc"
  navy: "#0f1729"
  navy-soft: "#344054"
  navy-muted: "#4b5565"
  brand: "#323f7b"
  brand-gem: "#b7b8b9"
  background: "#f4f7fc"
  canvas-sky: "#cfe1f6"
  canvas-lilac: "#e6e4f7"
  canvas-mist: "#eef4fc"
  card: "#ffffff"
  secondary: "#eef2fa"
  muted: "#eef2f8"
  muted-foreground: "#667085"
  border: "#e8edf5"
  border-soft: "#f0f3f9"
  input: "#f6f8fc"
  positive: "#157f43"
  positive-bg: "#e8f7ef"
  negative: "#cf2b1f"
  negative-bg: "#fef3f2"
  warn: "#b54708"
  warn-bg: "#fef6ee"
  violet: "#7839ee"
  violet-bg: "#f4f0fe"
  teal: "#0e9384"
  teal-bg: "#e7f7f5"
typography:
  wordmark:
    fontFamily: "Playfair Display, ui-serif, Georgia, serif"
    fontWeight: 700
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px–33.5px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px–11.5px"
    fontWeight: 700
    letterSpacing: "0.06em–0.14em"
rounded:
  chip: "8px"
  tile: "12px"
  card: "16px"
  sheet: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
  nav-pill-active:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
---

# Design System: LUSTRE Sales Intelligence

## Overview

**Creative North Star: "The Trading Floor Ledger"**

LUSTRE is read by sales reps and management mid-workday, between calls, not browsed for pleasure — so the system is built for scanning, not admiring. It is a premium enterprise SaaS surface: calm, spacious, restrained. One accent (a deliberate indigo-blue, `#2f4fe0`) carries every call to action and every "this is current" signal; everything else is navy ink on near-white. The diamond trade's own vocabulary — carat, clarity, cut, shape — appears throughout rather than generic analytics jargon, and a single serif wordmark (Playfair Display, with a gem standing in for the R's missing leg) is the only ornamental gesture in an otherwise fully sans-serif, fully functional interface.

Confirmed rejections (PRODUCT.md Brand Commitments): no gradients except where already deliberately shipped, no glassmorphism, no sparkle glyphs, no fake "Live" status dots, status never carried by colour alone.

**Key Characteristics:**
- Near-white canvas (`#f4f7fc`) under solid white cards — never pure white-on-white, never dark.
- One accent color, used sparingly: the active nav pill, primary buttons, links, "current" states.
- Tone-coded chips and badges (positive/negative/warn/violet/teal/neutral) do the emotional signaling color alone can't.
- Pill shapes everywhere controls live (nav, buttons, badges); cards and tiles get a softer, non-pill radius.
- No dark mode: a single light palette, deliberately — a client demo surface, not a developer tool.

## Colors

A near-monochrome navy-on-white base with exactly one accent, plus a small fixed vocabulary of semantic tones for data states.

### Primary
- **Ledger Indigo** (`#2f4fe0`): the one accent. Primary buttons, active nav pill, links, focus rings, "chance of hitting target" headline figures. Never decorative — every use of it means "act here" or "this is the current one."
- **Ledger Indigo, Deep** (`#2440c4`): hover/pressed state for the accent, never a resting color.

### Neutral
- **Ink Navy** (`#0f1729`): primary text, the wordmark's letterforms, dark surfaces like the nav-pill active label.
- **Soft Navy** (`#344054`) / **Muted Navy** (`#4b5565`): secondary text, de-emphasized labels.
- **Card White** (`#ffffff`): every card, the header pill, modals.
- **Canvas Mist** (`#f4f7fc` background, with `#cfe1f6`/`#e6e4f7`/`#eef4fc` as a faint sky-to-lilac gradient wash behind the header): the page ground reads as paper under glass, not stark white.
- **Hairline Border** (`#e8edf5`, softer at `#f0f3f9`): every card edge and divider. No shadows substitute for structure; borders do that job.

### Named Rules
**The One Accent Rule.** Ledger Indigo is the only color allowed to mean "primary action" or "current state" anywhere in the product. A second accent color is never introduced for emphasis — weight and size carry secondary emphasis instead.

**The Tone-Not-Color Rule.** Status (risk, growth, warning) is never shown by hue alone — every tone pairing (positive green / negative red / warn amber / accent blue / violet / teal) ships with an icon, direction arrow, or explicit label alongside the color, per the client's own accessibility commitment.

## Typography

**Display/Wordmark Font:** Playfair Display (serif, 700 weight) — the LUSTRE wordmark only, never used elsewhere.
**Body/UI Font:** Plus Jakarta Sans (with system-ui fallback) — everything else: headings, body copy, labels, numerals.

**Character:** One confident geometric sans carries the entire working interface; the single serif accent is reserved for brand identity, so the product never feels like it's trying to look "designed" at the expense of being scannable.

### Hierarchy
- **Display** (700, 19px–33.5px, tight tracking `-0.01em`): page titles and hero KPI figures (`kpi-value` class) — the one place size alone marks importance.
- **Body** (400, 13px, 1.5 line-height): table cells, descriptions, card copy.
- **Label** (700, 10.5px–11.5px, uppercase, `0.06em`–`0.14em` tracking): eyebrow-style section labels, KPI tile headers, table column headers.

### Named Rules
**The Tabular Numerals Rule.** Every number that appears in a column or is compared against another (KPI values, table figures, deltas) uses `tabular-nums` so digits align vertically — a trading-ledger reflex, not a cosmetic one.

## Layout

A single centered content column (max-width `1600px`) under a sticky header pill, with the content area owning its own scroll container (`#main-content`), not the window — the header never scrolls away. Cards stack in responsive grids (`sm:grid-cols-2`, `xl:grid-cols-4` for KPI rows) that collapse to one column below `sm`. The primary navigation itself only renders at the `xl` breakpoint (1280px) and above; below that, a mobile drawer (hamburger menu) is the only way to reach the rest of the product — there is currently no intermediate tablet-width nav treatment between the two.

## Elevation & Depth

Flat-by-default with one soft ambient shadow reserved for the header pill and floating/raised surfaces (drawers, dropdown menus) — not for ordinary cards, which rely on a 1px hairline border instead of a shadow to read as a distinct surface.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgba(15,23,41,0.04)`): the barely-there lift under every ordinary card — present mostly so a card never looks pasted flat onto the canvas, not to simulate real elevation.
- **Raised** (`0 8px 24px -6px rgba(15,23,41,0.1), 0 2px 6px rgba(15,23,41,0.05)`): drawers (notification panel, chat drawer, admin edit panel) and open dropdown menus — the one shadow strong enough to read as "floating above the page."
- **Pill** (`0 1px 2px rgba(15,23,41,0.06), 0 0 0 1px rgba(15,23,41,0.04)`): icon buttons sitting directly on the canvas (outside the header pill), where a border alone would be too faint against the gradient ground.

### Named Rules
**The Border-Over-Shadow Rule.** A resting card is a hairline border on white, not a shadow — shadows are reserved for things that are genuinely temporarily "above" the page (drawers, menus), never for permanent structure.

## Shapes

Two radius families, picked by role: a **pill** (`999px`) for anything a user clicks or that represents a single discrete state (nav items, buttons, icon buttons, badges), and a softer rounded-rectangle scale (`8px` chips → `12px` tiles → `16px` cards → `28px` the outer header sheet) for anything that contains content. Nothing is sharp-cornered; nothing exceeds the card radius except the header's own outer sheet, which is deliberately the roundest element on the page to read as "the frame," not "a card."

## Components

### Buttons
- **Shape:** pill (`999px` radius) at all sizes.
- **Primary:** Ledger Indigo fill, white text, a soft indigo-tinted shadow (`0 2px 8px -2px rgba(47,79,224,0.5)`) that deepens slightly on hover along with the fill darkening to Ledger Indigo Deep.
- **Secondary:** white fill, navy text, hairline border, card shadow; hovers to the Secondary grey fill.
- **Ghost:** transparent, muted navy text, no border — used for the quietest actions (icon-only triggers, inline links styled as buttons).

### Navigation (Header Nav Pill)
- **Style:** the entire primary nav lives inside one solid white pill (`.header-pill`) floating on the gradient canvas, itself using the Raised-family header shadow that deepens slightly once the page has scrolled.
- **Items:** each top-level destination is its own small pill (`.nav-pill`, 36px tall). Resting: transparent. Hover/open: Secondary grey fill. Active (current page): filled Ledger Indigo with a matching colored shadow — the only place in the header where fill, not just color, marks state.
- **Mobile:** below `xl`, the nav pills disappear entirely; a hamburger button opens a slide-over Drawer listing every destination as a two-line row (icon tile + label).

### Cards / Containers
- **Corner Style:** 16px (`.surface`), or 12px for a visually lighter "quiet" variant (`.surface-quiet`).
- **Background:** solid white.
- **Shadow Strategy:** the barely-there Card shadow — see Elevation.
- **Border:** 1px hairline (`--color-border`, or the softer `--color-border-soft` for the quiet variant) — this, not the shadow, is what actually separates a card from the canvas.

### Badges / Pills (status chips)
- **Style:** a small capsule (`.pill`, 999px radius, 3px/9px padding, 11.5px text) tinted per semantic tone (positive/negative/warn/accent/violet/teal/neutral) — background a pale tint of the tone, text and border the saturated version.
- **Use:** tier badges, KPI deltas, status labels — always paired with an icon or explicit word, never color alone (see Named Rule above).

### Drawers (slide-over panels)
- **Style:** fixed to the right edge, full viewport height, white, hairline left border, Raised shadow, sliding in from off-screen. A small accent-tinted icon badge (when the drawer declares one) precedes the title, matching `CardHeader`'s icon treatment.
- **Use:** notifications, the AI chat (Copilot), per-user admin edit panels, and (on mobile only) the primary navigation itself.

## Do's and Don'ts

### Do:
- **Do** keep Ledger Indigo as the only accent color on any given screen — a second saturated hue competing for attention is the fastest way to break the One Accent Rule.
- **Do** pair every status color with an icon, arrow, or word — never rely on hue alone (client accessibility commitment).
- **Do** use `tabular-nums` on any number appearing in a column, KPI tile, or delta.
- **Do** reserve the Raised shadow for things that are genuinely temporary/floating (drawers, open menus) — a resting card gets a border, not a shadow.

### Don't:
- **Don't** add gradients, glassmorphism, sparkle glyphs, or a fake "Live" pulsing dot anywhere — explicitly rejected in PRODUCT.md's Brand Commitments.
- **Don't** set the Playfair Display wordmark face anywhere outside the literal LUSTRE logo — it is brand identity, not a display-type option for page headings.
- **Don't** design a screen that only works at `xl`+ without checking the mobile drawer path — the primary nav bar itself vanishes below that breakpoint by design.
