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

> **Two things still open.** Nobody has compared the mark's greens against the official municipal site's own
> colours to confirm they are not accidentally close — independence is asserted, not verified. And because the
> emblem is derived from municipal motifs rather than unrelated to them, **"does not imply endorsement" is a
> judgement this project has made about itself and has not put to the municipality.** Both belong in the
> conversation that settles the seal question.

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

| Colour                 | On light (`neutral-0`) | On dark (`neutral-950`) |
| ---------------------- | ---------------------- | ----------------------- |
| Emblem light `#86d294` | 1.80:1 ⚠️              | 11.05:1                 |
| Emblem mid `#2e9b41`   | 3.57:1                 | 5.57:1                  |
| Emblem deep `#1c6b4c`  | 6.45:1                 | 3.09:1                  |
| Sun `#fcd116`          | 1.47:1 ⚠️              | 13.53:1                 |

**On a white page the rays read as a faint halo** — flag yellow is 1.47:1 on white by construction, and no
choice made here changes that. What makes the mark hold at header size is the emblem's hard circular edge, not
the rays. On the dark ground the whole mark is comfortable, and the deep green's 3.09:1 is the worst case
anywhere.

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

The mark's colours sit in `@theme` with no role indirection and no dark-mode override, because measured against
both grounds neither is needed. **When an inverse surface lands**, they get promoted to semantic roles the way
the sibling portal does it, and `better-tago-white.svg` is the record of what that reversed variant looks like.

`Logo.test.tsx` compares the component's viewBox, its seven path definitions and every transform against
`better-tago-color.svg` on each run, so the record and the lockup cannot drift apart silently.

## Not here yet

**Favicons.** There is no `public/` directory and no icon wired into the document head. The mark should not
simply be dropped in at 16px — the rays and the 2-unit channels fill in well below the 32px floor, and the
design sheet marks 20px as already too small. A favicon needs a _simplified_ cut of the mark, which is its own
piece of design work rather than a copy of these files.
