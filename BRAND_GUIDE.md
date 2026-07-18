# Banner Brand Guide — app rebrand source of truth

Reverse-engineered from the 2026 client pitch deck (`Deck 2026_v1.pdf`), supplied by James as the guide for rebranding the sales dashboard. **Hex values and font names below are estimated from the rendered deck — replace with the exact brand assets (logo SVG, hex codes, licensed font files) when supplied.** This is the single reference for every "prettier"/rebrand item in [PLATFORM_REVIEW_2026-06-29.md](PLATFORM_REVIEW_2026-06-29.md) §5, and for any cross-team design work.

## The one rule that fixes most of the app

The deck uses **exactly one primary accent: Banner Coral.** The app today scatters purple/indigo, blue, green, red and black as "primary" (see the visual audit). Rebranding = collapse all of that into this system:

- **Coral** — the only brand accent: primary actions, key numbers, active/selected state, the brand arc motif.
- **Navy** — dark surfaces, headers, dark stat cards.
- **Charcoal** — text.
- **Green** — positive money / success ONLY (on-goal, savings, positive delta).
- **Blue** — rare, informational only; never a second primary.
- **Red** — genuine errors/danger only (coral carries "brand", so reserve true red for alarms).
- **Purple / indigo — deleted.** The Today hero gradient, the ⌘J assistant FAB, the Coaching icon, and the Draft/Content selection are all off-brand → recolor to coral.

## Color tokens (estimated — confirm exact from brand assets)

```css
:root {
  /* Brand */
  --coral: #EE5340;         /* primary accent — logo, buttons, key numbers, arcs, active */
  --coral-hover: #E23F2B;
  --coral-tint: #FDECE9;    /* coral ~10% — pills, active-nav backgrounds, highlights */

  /* Neutrals */
  --navy: #16202E;          /* dark surfaces, table header rows, dark stat cards */
  --navy-soft: #1F2A3A;
  --ink: #1F2A37;           /* primary text + display headings on light */
  --slate: #6B7580;         /* secondary text, metadata */
  --canvas: #E9EEEF;        /* pale cool-grey page/section background */
  --surface: #FFFFFF;       /* cards / content */
  --hairline: #ECEEF1;      /* card borders, table row dividers */

  /* Semantic — used sparingly */
  --success: #2FBF71;       /* positive money / on-goal / savings only */
  --info:    #3B82F6;       /* informational only */
  --danger:  #DC3545;       /* true errors only */

  /* Shape */
  --radius-card: 20px;
  --radius-image: 24px;
  --radius-pill: 999px;
}
```

Dark (navy) surfaces use white text with **coral** for the numbers/emphasis — matches the deck's stat cards.

## Typography (confirm licensed fonts)

- **Display / headings** — geometric humanist sans with rounded terminals (Sofia Pro / Gordita / Poppins character). Titles are large and *light-to-medium* weight, not heavy; one word is often set in coral.
- **Eyebrow labels** — small ALL-CAPS, letter-spaced, coral (e.g. "WHY USE BANNER", "ROI CASE").
- **Body** — clean neutral sans (Inter-like); bold lead-in + regular remainder.
- **Closest free stand-ins until the licensed font is supplied:** display → Poppins (or Sofia Sans) 400–600; body → Inter 400/600.

```css
--font-display: 'Poppins', 'Sofia Sans', system-ui, sans-serif;  /* swap for the licensed brand font */
--font-body: 'Inter', system-ui, sans-serif;
```

## Signature motifs

- **Coral arc / ring device** — partial concentric circles ("C" arcs) at corners/edges, overlapping photos and headers. This is THE brand device. Use it subtly on page headers, hero and empty states (SVG or a masked pseudo-element). Don't overuse.
- **Frosted-glass card** — semi-white `backdrop-filter: blur()` card over hero imagery (the cover-slide look). Good for the Today hero and the login screen.
- **Generous rounded corners** — cards 20px, images 24px, pills/buttons full.
- **Two-tone line icons** — navy stroke + coral accent (style lucide icons: navy default, coral for the active/emphasis glyph).
- **Imagery** — bright, contemporary multifamily / CRE architecture, blue sky; rounded frame, often on a navy offset block.

## Component recipes (deck → app)

- **Buttons** — Primary: coral fill, white text, rounded. Secondary: navy fill, white text. Tertiary: hairline outline, ink text. (Kills the "three random button colors per screen" problem.)
- **Stat tile, dark** — navy card, big coral number (`--font-display`), white label beneath. Use for hero KPIs.
- **Stat tile, light** — white card, hairline border, coral number, slate label.
- **Table** — navy header row, white body, `--hairline` dividers, generous padding; an emphasis column header may be coral (or `--success` for a savings/positive column).
- **Pill / eyebrow** — coral-tint bg + coral text, or navy-tint + slate; rounded-full.
- **Active / selected nav** — coral text on `--coral-tint` bg. Replace the app's per-screen black-underline / blue-underline / black-segment inconsistency with this single treatment.
- **Process steps** — coral square number chips (01/02/03) or a coral top-border accent on the card.
- **Positive list bullets** — `--success` circle check.

## Stage colors — define once, globally

The app renders pipeline stages with different names and arbitrary rainbow colors per screen. Define ONE ordered, sequential ramp (a single-hue tint ramp, or navy→coral) plus one label map in `lib/constants.js`, and import it everywhere (Bottleneck, Stage Analytics, CEO/Team bars, Pipeline). No rainbow, no per-screen drift.

## Don'ts (straight from the visual audit)

- No purple/indigo anywhere.
- No red "Live" pills; no alarm-red on zero/empty values.
- Green never means "all active" or a late-stage count — only genuinely positive money.
- No native OS `<select>` — use styled dropdowns.
- One accent, one stage-color system, one active-state treatment, app-wide.

## Product/positioning context from the deck (bonus, for content generation)

Useful grounding for Content Studio / RFP / prep briefs and the `sales_process_config`: Banner = CapEx management software for commercial real estate (multifamily-origin). Headline outcomes — reduce ~80% of admin time (10 hrs/person/wk, 99% fewer data errors), ~3.3% capex-budget savings, ~2.4% hard-cost savings via competitive bidding, 4.1 days faster unit turns, accelerate pre-construction. Proof points — LivCor, American Campus Communities, April Housing, AIR Communities, FCP, Greystar, BRE; backed by Blackstone, Prudential, Y Combinator; started 2019. Differentiators — white-glove support (30-sec response, 10 hrs/day, founder access), rapid custom features in ~1 week, AppFolio/Yardi/Workday/DSSI integrations, highly configurable. Pricing — based on annual construction spend (single variable, all modules included).
