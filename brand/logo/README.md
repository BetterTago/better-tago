# The BetterTago mark

The portal's logo, in its three delivered variants. These are the **source of record** for the mark, and
`src/components/ui/Logo.tsx` inlines the same geometry.

| File                    | Use                                           |
| ----------------------- | --------------------------------------------- |
| `better-tago-color.svg` | Primary — three-green emblem, flag-yellow sun |
| `better-tago-black.svg` | One-colour black                              |
| `better-tago-white.svg` | Reversed, for dark grounds                    |

## What it is

- **Sun** — eight points of three rays each, **derived from the Philippine flag sun but redrawn, not
  flag-official.** Every ray is bent along a curve and leans the same rotational direction, and the whole set
  is turned 20° clockwise, so the sun reads as swaying behind a turn. `#fcd116`, the flag's yellow. The rays
  are drawn from the centre outward, so all eight overlap in a solid core; a mask then cuts a 30.5-unit hole
  out of it so the rays **stop clear of the disc**.
- **Emblem** — a three-part disc in place of the sun's own. Light, mid and deep green, divided by two organic
  channels: `#86d294`, `#2e9b41`, `#1c6b4c`. Its edge sits at 26.5 units, four units clear of where the rays
  begin, so the ring between them is deliberate and reads as clean negative space. It turns with the rays, on
  the same 20°.
- **Channels** — the same two curves that divide the regions, redrawn at a 2-unit stroke into a mask, so a gap
  is cut between them rather than a colour boundary. That is what keeps the three regions readable when the
  mark is drawn in a single colour — the black and reversed variants, where all three fills are identical and
  the channels are the _only_ thing separating them.
- **Minimum size 32px**, the design sheet's own floor; it marks 20px as too small. Below the floor the thin
  rays and the 2-unit channels fill in. The header renders it at 36.
- **Clear space** — keep a field equal to **the emblem's radius** on all four sides, and let nothing enter it:
  type, rules, image edges. That is 26.5 units of the 114-unit box, so **8.4px when the mark is drawn at 36**.
  The header uses `gap-3` (12px) for exactly this reason; `gap-2` would put the wordmark inside the field.

### 🙅 The municipal emblem, and what this mark takes from it

**No part of the municipal seal is reproduced, and the seal appears nowhere in this repository.** It is not
free to reuse, using it would require written permission this project has not asked for and does not have, and
it would falsely imply an endorsement.

**But this mark is not unrelated to it either.** The emblem's two channels are consciously **derived from** the
municipal emblem's own motifs — the range meeting the sea, and the Tago River — abstracted into flat geometry
that survives at 32px. The design work behind the mark is explicit on both halves of that: it takes its cues
from the municipal emblem, and it reproduces none of it, which stays the municipality's.

Both facts have to be stated together, because either one alone is misleading. **This is a recorded decision,
not an oversight** — a future contributor should not re-open it by assumption, and should not "simplify" it
back to "nothing to do with the seal."

The palette is separately **deliberately independent** of the municipality's visual identity, for the reason in
`portal.paletteNote` in `config/lgu.config.json`: visual similarity to official material reads as affiliation
to a resident skimming a page, which is the one impression this project must never give.

### The colour comparison — run 2026-08-09

**Result: no collision, and nothing to change.** Independence is now measured rather than asserted.

**Method.** Every hex literal in the official municipal site's home page and in its theme's `theme.css` and
`style.css` was extracted, converted to OKLCH, and compared against this mark's four colours and the portal's
`primary` and `accent` ramps. Hue gap is the metric that matters — two colours a resident would call "the same
green" sit within a few degrees of each other, whatever their lightness.

**What the official site's own palette turned out to be: greyscale.** Its chrome runs `#f7f7f7` → `#e9e9e9` →
`#313131`, and it declares **no chromatic brand colour at all** — the site is a Philippine government
WordPress template, and the template is neutral.

**The one apparent near-miss, and why it is not one.** The closest pair found was a green at hue 148.2°
against this mark's emblem green at 146.1° — a 2.1° gap, which would be a genuine collision. It is not
municipal. That value is `#67a671`, one stop of WordPress's stock _"subdued olive"_ gradient preset, which
ships with the software on every site that runs it. The other chromatic value in range, a red at hue 26.0°, is
a loading-placeholder animation belonging to a popular-posts plugin. **Neither is a colour the municipality
chose**, and this is recorded precisely so the next contributor who runs this comparison does not rediscover
the same 2.1° and mistake it for a real finding.

**Against colours the municipality actually chose, there is nothing to compare** — it has not declared any on
its website. The mark's greens therefore collide with nothing.

> **Since re-measured against a changed palette (2026-08-09).** At the time of the comparison the portal ran a
> provisional teal `primary` and amber `accent`, both unrelated to the mark. The palette has since been settled
> **on the mark itself**, so `primary` and `accent` now _are_ the emblem greens and the sun — which is why the
> finding above still holds and now covers the whole site rather than just the logo. What it does mean is that
> the derivation noted below applies to every surface, not only the header.

**What this comparison does _not_ cover**, and should not be read as covering: the seal's own colours as
printed, municipal signage, letterhead, vehicle livery, or anything else off the website. It compared one
website's CSS.

> **The residual, stated plainly rather than resolved quietly.** Because the emblem is derived from municipal
> motifs rather than unrelated to them, **"does not imply endorsement" remains a judgement this project has
> made about itself.** It has not been put to the municipality, and — with this project taking its information
> from the official site directly rather than by correspondence — there is no plan to put it to them.
>
> The position this project takes, and will defend: no seal artwork is reproduced, the cues are abstracted
> past recognition, the measurement above found no collision with anything the municipality chose, and every
> page states the project is independent and not an official channel. **If the municipality ever says the mark
> reads as theirs, it gets redrawn** — that commitment stands whether or not anyone asks first.

## Licence

**CC BY 4.0** — share and adapt with attribution, including commercially. Recorded in `LICENSE` at the root
of this repository, which is the authoritative statement; this is a pointer, not a second licence.

It is stated at all because an asset with no recorded licence is a problem in a civic project, not a detail —
and one carrying motifs derived from municipal imagery is a slightly larger one. What the licence cannot grant
is permission to imply that this project or the municipality endorses a reuse, or to deploy this mark somewhere
it would read as municipal. That is a question about truthfulness, not about copyright.

**The municipal seal is not covered by this or any licence here, because it is not here.**

## Framing

All three files are `viewBox="43 -1 114 114"`, and the artwork is **square**. The painted ink occupies
`43.63 -0.37 112.75 112.75` — centred on the sun's own origin, with 0.63 units of air inside the declared box,
a 0.55% margin.

That is close enough to edge-to-edge that the component uses the delivered framing verbatim rather than
carrying a second set of numbers, and `Logo.test.tsx` asserts the two agree.

> **Measuring this yourself: rasterise and scan pixels.** Both of the obvious shortcuts lie about this mark.
> `getBBox()` on a `<use>` reports the _referenced_ geometry before the element's own transform. And
> `getBoundingClientRect()` on a `<use>` whose reference is **rotated** takes the referenced content's
> axis-aligned box first and then transforms that rectangle — with eight rays at 45° spacing that returns
> 119.79 instead of 112.75, a 6% overstatement that looks exactly like the mark overflowing its own viewBox.

## Legibility

Measured against the two page grounds in `src/app/globals.css`. The 3:1 line is WCAG's floor for a graphical
object; **a logotype is exempt from it**, and this mark is `aria-hidden` beside a text wordmark that carries
the meaning — so the two failures below are recorded, not outstanding.

**Re-measured 2026-08-09**, against the two page grounds as they are now: the light "paper" ground
`#f3f7f4` and the "night" ground `#02110a`. Both moved when the palette was settled on the mark, so the
earlier figures — taken against pure white and a cool near-black — no longer describe anything a reader sees.

| Colour                 | On paper (`#f3f7f4`) | On night (`#02110a`) |
| ---------------------- | -------------------- | -------------------- |
| Emblem light `#86d294` | 1.67:1 ⚠️            | 10.73:1              |
| Emblem mid `#2e9b41`   | 3.30:1               | 5.41:1               |
| Emblem deep `#1c6b4c`  | 5.96:1               | 2.996:1 ⚠️           |
| Sun `#fcd116`          | 1.36:1 ⚠️            | 13.13:1              |

**On the light page the rays read as a faint halo** — flag yellow on a near-white ground is ~1.4:1 by
construction, and no choice made here changes that. What makes the mark hold at header size is the emblem's
hard circular edge, not the rays.

**On the dark ground the deep green is now the worst case anywhere, at 2.996:1** — and the reason is worth
stating because it is counter-intuitive. The night ground is itself green-tinted, so **lightening it closes
the gap to the deep green rather than opening it**: 17% lightness gives 2.94, 18.5% gives 2.87. Its 16% is
therefore a **ceiling**, not a preference, and it is the best ratio available to this mark on a dark ground.
`src/lib/theme-tokens.test.ts` asserts the direction, so nobody can brighten the dark theme "a little"
without the build saying what it costs.

All three ⚠️ rows are **recorded, not outstanding**, for the same reason: a logotype is exempt from the 3:1
graphical-object floor, this mark ships `aria-hidden`, and the text wordmark beside it carries the meaning.

The three regions do **not** separate from each other by contrast (1.8–2.0:1 between neighbours). They separate
by the channel cut between them, which is why the channel is a mask and not a colour boundary.

## How the app uses it

**Not these files.** `src/components/ui/Logo.tsx` inlines the geometry as a Server Component so the four fills
come from named `@theme` tokens (`--color-mark-emblem-{light,mid,deep}`, `--color-mark-sun`) instead of being
frozen into the file. That is what lets one component render every variant, and it is also what keeps the mark
from smuggling a colour literal past the guardrail scan in `src/lib/guardrails.test.ts`.

Three things in that component are load-bearing:

- **`idPrefix` is required.** Two masks, a clip path and both `<use>` chains need document-unique ids, and a
  Server Component cannot call `useId()`. Two instances sharing a prefix would break the second one's masks —
  and the first would still look perfect.
- **The masks' `white` and `black` are luminance, not colour.** White keeps, black cuts. They stay keywords on
  purpose: tokenising them would punch a hole in the sun or fill in the emblem's channels.
- **The two `rotate(20)` values must stay in step.** The sun and the emblem are separate groups because only
  one of them is masked, but they are one artwork. Turning either alone twists the channels out of the rays'
  rhythm.

**The inverse surface has since landed, and the fills are now roles.** Two levels, and the separation is the
point:

- `--mark-delivered-{emblem-light,emblem-mid,emblem-deep,sun}` — the artefact, in hex, never overridden.
- `--mark-{emblem-light,emblem-mid,emblem-deep,sun}` — the **role**, resolving to the artefact on the page and
  to white inside `[data-surface='inverse']`.

That is what lets **one component render all three delivered variants** — colour, colour-on-dark, and the
reversed all-white mark — instead of shipping three SVGs. `better-tago-white.svg` stays the record of what the
reversed variant must look like.

There is still **no dark-mode override**: measured against both grounds, none is needed. And the delivered
values keep their own tokens even though `--color-accent-400` now holds the same value as
`--mark-delivered-sun` — a future change to the accent ramp must not reach the logo, and the separation is the
only thing keeping that true.

`Logo.test.tsx` compares the component's viewBox, its seven path definitions and every transform against
`better-tago-color.svg` on each run, so the record and the lockup cannot drift apart silently.

## Not here yet

**Favicons.** There is no `public/` directory and no icon wired into the document head. The mark should not
simply be dropped in at 16px — the rays and the 2-unit channels fill in well below the 32px floor, and the
design sheet marks 20px as already too small. A favicon needs a _simplified_ cut of the mark, which is its own
piece of design work rather than a copy of these files.
