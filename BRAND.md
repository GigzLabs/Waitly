# Waitly brand

**Waitly** is the live floor for restaurants. Every table, every guest, in real time. The brand is calm, precise and hospitable: it never shouts, because the floor is already loud.

The complete brand book, tokens, logo files and component previews are published as a design system: https://claude.ai/artifact/Cxhgbek3EtkfU91RVsaEDy (private until shared). The same values live in this repo in `src/app/globals.css` and `brand/`.

## Name and tagline
- Product name in text: **Waitly**. Wordmark: lowercase `waitly`, Manrope 800, outlined (never retyped).
- Tagline: **Every table, in real time.**
- Feature lines (from the source video, kept as product language): *No forgotten guest* · *Tables ready faster* · *The next free table* · *Your peak times* · *No new equipment*.

## Mark
A table seen from above: a ring with an opening and a dot at the opening. In the product the same ring wraps every table and the dot takes the table's status colour, so the logo and the interface are one drawing. Files in `brand/logo/`:

| File | Use |
|---|---|
| `waitly-lockup.svg` | Default, light grounds |
| `waitly-lockup-dark.svg` | Dark grounds |
| `waitly-lockup-white.svg` | Photography, brand-blue ground |
| `waitly-mark*.svg` | Mark alone (brand, dark, ink, white) |
| `waitly-wordmark*.svg` | Wordmark alone (ink, white) |
| `waitly-app-icon*.svg` | Home-screen icon and favicon |

Clear space: the dot's diameter on every side. Minimum size: mark 20px, lockup 96px wide.

## Colour
Light is the canonical theme; the floor app defaults to dark because dining rooms are dim. Every token exists in both.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `bg` | `#f5f7fa` | `#0b1220` | Page ground |
| `surface` | `#ffffff` | `#121b2b` | Cards, panels |
| `surface-2` | `#eef2f7` | `#1a2537` | Inset areas |
| `border` | `#e1e6ee` | `#263247` | Hairlines |
| `ink` | `#0e1726` | `#f2f5fa` | Primary text |
| `ink-2` | `#4b5869` | `#b6c0d0` | Secondary text |
| `ink-3` | `#6e7b8e` | `#8593a8` | Muted text, eyebrows |
| `brand` | `#2457e6` | `#6b9bff` | Primary action, selection, the mark |
| `free` | `#15803d` | `#2be08a` | Table free |
| `seated` | `#e11d48` | `#ff4d6d` | Table seated, escalated alert |
| `cleaning` | `#b45309` | `#f5a623` | Needs cleaning, open alert |
| `next` | `#2457e6` | `#6b9bff` | Next-up prediction rings |
| `held` | `#6d28d9` | `#b794ff` | Held for a party |

Rules: one brand-coloured thing per screen. A status colour always travels with its word or its timer. No gradients, no coloured left borders; the ring carries the state.

## Type
One family, **Manrope**, everywhere. Weight does the hierarchy: 800 display, 700 titles and timers, 600 labels and buttons, 400 body. Timers and counts use tabular numerals. Eyebrows are 11px uppercase with 0.08em tracking.

Scale: display-xl 64 · display 44 · h1 32 · h2 24 · h3 18 · body 15 · body-sm 13 · label 11 · timer 28 · numeral-xl 48.

## Voice
Guests, not customers. Servers, not waiters. Four states: Free, Seated, Needs cleaning, Held. Alerts read "Table 2 · Seated 5 min, no server yet". Buttons say what happens: Seat party, Server arrived, Guests left, Mark cleaned. No exclamation marks, no emoji.

## Motion and layout
4px grid. Radii 8/12/16/24 and pills. 150 to 220ms ease-out. Rings pulse only while an alert is open. Touch targets 44px on the floor. Summary before detail: occupancy and alert count in the header, then the floor, then lists.
