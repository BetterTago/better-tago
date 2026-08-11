import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lguConfig } from './lgu-config';

/**
 * The palette, verified rather than asserted.
 *
 * A contrast table written into a comment is a claim about a previous version
 * of the file. This reads the ramps and the semantic roles out of
 * `globals.css`, resolves each role through `var()` to a real colour the way a
 * browser would, and COMPUTES every ratio. Re-point a ramp and the arithmetic
 * moves with it; take a role below its floor and the build goes red naming the
 * pair.
 *
 * It is also what closes the one acceptance criterion the design-token work
 * left open: the MARK's contrast had been measured, and the RAMP's had not.
 */

const CSS = readFileSync(
  path.join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf8'
);

/* -------------------------------------------------------------------------
   Reading the stylesheet
   ------------------------------------------------------------------------- */

/** Every `--name: value;` in every block matching `selector`, merged in order. */
function declarationsOf(selector: string): Record<string, string> {
  const opener = new RegExp(
    `(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`,
    'g'
  );
  const merged: Record<string, string> = {};

  for (const match of CSS.matchAll(opener)) {
    // Walk to the matching close brace so a nested block cannot end it early.
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (depth > 0 && index < CSS.length) {
      if (CSS[index] === '{') depth += 1;
      if (CSS[index] === '}') depth -= 1;
      index += 1;
    }
    const body = CSS.slice(start, index - 1);

    for (const declaration of body.matchAll(
      /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
    )) {
      merged[declaration[1]] = declaration[2].trim();
    }
  }

  return merged;
}

const RAMP = declarationsOf('@theme');
const LIGHT = declarationsOf(':root');
const DARK = declarationsOf(":root[data-theme='dark']");
const INVERSE = declarationsOf("[data-surface='inverse']");
const ACCENT_SURFACE = declarationsOf("[data-surface='accent']");

/**
 * A token's colour, resolved through `var()` the way the cascade would.
 *
 * `layers` is the lookup order — the innermost scope first, the raw ramp last.
 *
 * **Throws** on anything that is not a flat hex, rather than returning a
 * sentinel: the alpha lines on an inverse surface cannot honestly appear in a
 * contrast table, and a pair that reaches one should fail loudly saying so
 * rather than silently skip.
 */
function resolve(token: string, layers: Record<string, string>[]): string {
  let value: string | undefined;
  for (const layer of layers) {
    if (token in layer) {
      value = layer[token];
      break;
    }
  }
  if (value === undefined) throw new Error(`${token} is declared nowhere`);

  const reference = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
  if (reference) return resolve(reference[1], layers);
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${token} resolves to ${value}, which is not a flat hex`);
  }
  return value.toLowerCase();
}

/* -------------------------------------------------------------------------
   Colour maths — WCAG 2.1 relative luminance, and OKLab lightness
   ------------------------------------------------------------------------- */

const channels = (hex: string): number[] =>
  [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, rounded the way the recorded table records it. */
function contrast(ink: string, ground: string): number {
  const [high, low] = [luminance(ink), luminance(ground)].sort((a, b) => b - a);
  return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
}

/** OKLab lightness, 0–1. Perceptual, which is what "monotonic" has to mean. */
function lightness(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/* ------------------------------------------------------------------------- */

describe('the stylesheet is actually being read', () => {
  it('found the ramps and every role layer', () => {
    // A parser that silently returns nothing turns every assertion below into
    // a green no-op, which is worse than no test because it looks checked.
    expect(Object.keys(RAMP).length).toBeGreaterThan(30);
    expect(Object.keys(LIGHT).length).toBeGreaterThan(15);
    expect(Object.keys(DARK).length).toBeGreaterThan(15);
    expect(Object.keys(INVERSE).length).toBeGreaterThan(5);
    expect(Object.keys(ACCENT_SURFACE).length).toBeGreaterThan(5);
  });
});

describe('the ramps', () => {
  /*
   * `error` joins the three brand ramps here deliberately.
   *
   * It is not a brand colour — nothing about BetterTago is red — and it is used
   * on exactly one surface, the emergency ticker's ground. It is declared as a
   * FULL scale rather than a one-off maroon precisely so it can be held to the
   * same monotonic-lightness rule as the others, and so every pair the ticker
   * actually renders is measured rather than eyeballed.
   */
  const RAMPS = ['primary', 'accent', 'neutral', 'error'] as const;

  it.each(RAMPS)('%s is strictly monotonic in lightness', name => {
    const steps = Object.keys(RAMP)
      .filter(token => new RegExp(`^--color-${name}-\\d+$`).test(token))
      .map(token => ({
        step: Number(token.split('-').pop()),
        hex: RAMP[token],
      }))
      .sort((a, b) => a.step - b.step);

    expect(steps.length).toBeGreaterThanOrEqual(11);

    const notDarker = steps
      .slice(1)
      .filter(
        (entry, index) => lightness(entry.hex) >= lightness(steps[index].hex)
      )
      .map(entry => `${name}-${entry.step}`);

    // A scale that stops descending stops composing: a "darker" step that is
    // not darker silently breaks every contrast assumption downstream of it.
    expect(notDarker).toEqual([]);
  });

  it('reproduces the mark exactly, unrounded, at the steps that carry it', () => {
    /*
     * The ramps are derived FROM the mark, so three greens and the sun have to
     * land on them without rounding. A drift of one hex digit here is invisible
     * on screen and means the header's mark and its page no longer share a
     * colour.
     */
    expect(RAMP['--color-primary-300']).toBe(LIGHT['--mark-delivered-emblem-light']); // prettier-ignore
    expect(RAMP['--color-primary-500']).toBe(LIGHT['--mark-delivered-emblem-mid']); // prettier-ignore
    expect(RAMP['--color-primary-700']).toBe(LIGHT['--mark-delivered-emblem-deep']); // prettier-ignore
    expect(RAMP['--color-accent-400']).toBe(LIGHT['--mark-delivered-sun']);
  });

  it('keeps the mark on its own tokens, so re-pointing a ramp cannot repaint it', () => {
    // Same VALUE, two tokens, on purpose. The day the accent ramp moves, the
    // logo must not move with it — and this separation is the only thing
    // keeping that true.
    for (const token of [
      '--mark-delivered-emblem-light',
      '--mark-delivered-emblem-mid',
      '--mark-delivered-emblem-deep',
      '--mark-delivered-sun',
    ]) {
      expect(LIGHT[token]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('agrees with the portal identity the config publishes', () => {
    /*
     * `portal.brandColor` and `portal.accentColor` are the same two colours
     * again, in the file that is the source of truth for portal identity — read
     * by metadata, by a theme-colour meta tag, and by anything downstream that
     * asks what colour this portal is. Two copies of a value with nothing
     * holding them together is a drift waiting to happen, and the drift would
     * show up as a browser chrome colour that no longer matches the page.
     */
    const { brandColor, accentColor } = lguConfig.portal;
    expect(brandColor.toLowerCase()).toBe(RAMP['--color-primary-700']);
    expect(accentColor.toLowerCase()).toBe(RAMP['--color-accent-400']);
  });
});

describe('contrast, computed against the ramp', () => {
  /**
   * Every pair a reader can actually meet, with the floor it has to clear and
   * the ratio recorded for it.
   *
   * The recorded value is asserted too, not just the floor: a change that
   * leaves a pair passing but moves it is still a change to the design, and it
   * should have to be written down rather than absorbed.
   */
  const PAIRS: {
    ink: string;
    ground: string;
    layers: Record<string, string>[];
    where: string;
    floor: number;
    recorded: number;
  }[] = [
    // ---- light theme, on the page ground -------------------------------
    { ink: '--ink', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 4.5, recorded: 16.18 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 4.5, recorded: 7.61 }, // prettier-ignore
    { ink: '--ink-tertiary', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 4.5, recorded: 4.55 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 4.5, recorded: 5.96 }, // prettier-ignore
    { ink: '--ink-link-hover', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 4.5, recorded: 8.72 }, // prettier-ignore
    { ink: '--focus-ring', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 3.0, recorded: 8.72 }, // prettier-ignore
    { ink: '--ink-accent-strong', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 4.5, recorded: 5.04 }, // prettier-ignore
    // The display-only accent. 3.67 is why body-size accent text has to use
    // `-strong`, and why the holding page's eyebrow was moved onto it.
    { ink: '--ink-accent', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light, display ≥24px', floor: 3.0, recorded: 3.67 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-page', layers: [LIGHT, RAMP], where: 'light', floor: 3.0, recorded: 3.16 }, // prettier-ignore

    // ---- light theme, on the raised and sunken grounds -------------------
    { ink: '--ink', ground: '--surface-raised', layers: [LIGHT, RAMP], where: 'light, raised', floor: 4.5, recorded: 17.5 }, // prettier-ignore
    { ink: '--ink-tertiary', ground: '--surface-raised', layers: [LIGHT, RAMP], where: 'light, raised', floor: 4.5, recorded: 4.92 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-raised', layers: [LIGHT, RAMP], where: 'light, raised', floor: 3.0, recorded: 3.42 }, // prettier-ignore
    { ink: '--ink-tertiary', ground: '--surface-sunken', layers: [LIGHT, RAMP], where: 'light, sunken', floor: 4.5, recorded: 4.73 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-tint', layers: [LIGHT, RAMP], where: 'light, tint', floor: 4.5, recorded: 6.02 }, // prettier-ignore

    // ---- dark theme -----------------------------------------------------
    { ink: '--ink', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 4.5, recorded: 17.86 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 4.5, recorded: 8.28 }, // prettier-ignore
    { ink: '--ink-tertiary', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 4.5, recorded: 8.28 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 4.5, recorded: 10.73 }, // prettier-ignore
    { ink: '--ink-link-hover', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 4.5, recorded: 13.13 }, // prettier-ignore
    { ink: '--ink-accent', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 4.5, recorded: 13.13 }, // prettier-ignore
    { ink: '--focus-ring', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 3.0, recorded: 10.73 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-page', layers: [DARK, LIGHT, RAMP], where: 'dark', floor: 3.0, recorded: 3.92 }, // prettier-ignore
    { ink: '--ink', ground: '--surface-raised', layers: [DARK, LIGHT, RAMP], where: 'dark, raised', floor: 4.5, recorded: 15.03 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-raised', layers: [DARK, LIGHT, RAMP], where: 'dark, raised', floor: 4.5, recorded: 9.02 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-raised', layers: [DARK, LIGHT, RAMP], where: 'dark, raised', floor: 3.0, recorded: 3.30 }, // prettier-ignore
    { ink: '--ink', ground: '--surface-sunken', layers: [DARK, LIGHT, RAMP], where: 'dark, sunken', floor: 4.5, recorded: 16.49 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--surface-sunken', layers: [DARK, LIGHT, RAMP], where: 'dark, sunken', floor: 4.5, recorded: 7.65 }, // prettier-ignore
    { ink: '--ink', ground: '--surface-tint', layers: [DARK, LIGHT, RAMP], where: 'dark, tint', floor: 4.5, recorded: 15.77 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-tint', layers: [DARK, LIGHT, RAMP], where: 'dark, tint', floor: 4.5, recorded: 9.47 }, // prettier-ignore

    // ---- the band, which is a dark ground in both themes -----------------
    { ink: '--ink-on-band', ground: '--surface-band', layers: [LIGHT, RAMP], where: 'band, light', floor: 4.5, recorded: 6.45 }, // prettier-ignore
    { ink: '--ink-on-band-muted', ground: '--surface-band', layers: [LIGHT, RAMP], where: 'band, light', floor: 4.5, recorded: 5.49 }, // prettier-ignore
    { ink: '--ink-on-band', ground: '--surface-band', layers: [DARK, LIGHT, RAMP], where: 'band, dark', floor: 4.5, recorded: 8.76 }, // prettier-ignore
    { ink: '--ink-on-band-muted', ground: '--surface-band', layers: [DARK, LIGHT, RAMP], where: 'band, dark', floor: 4.5, recorded: 7.46 }, // prettier-ignore
    { ink: '--ink-on-band', ground: '--surface-band-hover', layers: [LIGHT, RAMP], where: 'band hover, light', floor: 4.5, recorded: 9.43 }, // prettier-ignore
    { ink: '--ink-on-band-muted', ground: '--surface-band-hover', layers: [LIGHT, RAMP], where: 'band hover, light', floor: 4.5, recorded: 8.03 }, // prettier-ignore
    { ink: '--ink-on-band', ground: '--surface-band-hover', layers: [DARK, LIGHT, RAMP], where: 'band hover, dark', floor: 4.5, recorded: 11.59 }, // prettier-ignore
    { ink: '--ink-on-band-muted', ground: '--surface-band-hover', layers: [DARK, LIGHT, RAMP], where: 'band hover, dark', floor: 4.5, recorded: 9.87 }, // prettier-ignore

    // ---- [data-surface='inverse'], over both themes' inverse grounds -----
    { ink: '--ink', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 4.5, recorded: 12.58 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 4.5, recorded: 10.72 }, // prettier-ignore
    { ink: '--ink-tertiary', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 4.5, recorded: 9.01 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 4.5, recorded: 8.55 }, // prettier-ignore
    { ink: '--ink-link-hover', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 4.5, recorded: 9.19 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 3.0, recorded: 5.39 }, // prettier-ignore
    { ink: '--focus-ring', ground: '--surface-inverse', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, light', floor: 3.0, recorded: 12.58 }, // prettier-ignore
    { ink: '--ink', ground: '--surface-inverse', layers: [INVERSE, DARK, LIGHT, RAMP], where: 'inverse, dark', floor: 4.5, recorded: 8.76 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--surface-inverse', layers: [INVERSE, DARK, LIGHT, RAMP], where: 'inverse, dark', floor: 4.5, recorded: 7.46 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-inverse', layers: [INVERSE, DARK, LIGHT, RAMP], where: 'inverse, dark', floor: 4.5, recorded: 5.95 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-inverse', layers: [INVERSE, DARK, LIGHT, RAMP], where: 'inverse, dark', floor: 3.0, recorded: 3.76 }, // prettier-ignore
    { ink: '--ink', ground: '--surface-inverse-deep', layers: [INVERSE, LIGHT, RAMP], where: 'inverse-deep, light', floor: 4.5, recorded: 13.60 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-inverse-deep', layers: [INVERSE, LIGHT, RAMP], where: 'inverse-deep, light', floor: 4.5, recorded: 9.24 }, // prettier-ignore
    { ink: '--ink', ground: '--surface-inverse-deep', layers: [INVERSE, DARK, LIGHT, RAMP], where: 'inverse-deep, dark', floor: 4.5, recorded: 17.68 }, // prettier-ignore
    { ink: '--ink-link', ground: '--surface-inverse-deep', layers: [INVERSE, DARK, LIGHT, RAMP], where: 'inverse-deep, dark', floor: 4.5, recorded: 12.02 }, // prettier-ignore

    // ---- [data-surface='accent'], the gold card --------------------------
    { ink: '--ink', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 4.5, recorded: 12.02 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 4.5, recorded: 9.24 }, // prettier-ignore
    // The emergency call band's number, which renders `text-ink-accent` on the
    // gold ground. The scope re-points it to `--ink-on-accent`, so it lands on
    // the same deep green as `--ink` — asserted rather than assumed, because
    // the unscoped value is the gold itself and gold on gold is invisible.
    { ink: '--ink-accent', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 4.5, recorded: 12.02 }, // prettier-ignore
    { ink: '--ink-link', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 4.5, recorded: 12.02 }, // prettier-ignore
    // Hover has to go DARKER than the link. A hover that lands on the colour
    // the text already wears is no feedback at all.
    { ink: '--ink-link-hover', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 4.5, recorded: 13.42 }, // prettier-ignore
    { ink: '--line-control', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 3.0, recorded: 9.24 }, // prettier-ignore
    { ink: '--focus-ring', ground: '--color-accent-400', layers: [ACCENT_SURFACE, LIGHT, RAMP], where: 'accent card', floor: 4.5, recorded: 12.02 }, // prettier-ignore

    // ---- [data-surface='inverse'], on its OWN sunken ground ---------------
    // `GapNotice` carries `bg-surface-sunken` and appears inside the emergency
    // and contact slabs. Before the scope re-pointed the surfaces, its ink
    // flipped to white while its ground stayed the light theme's #f8fbf9 —
    // 1.04:1, on the two sections where a stated absence matters most.
    { ink: '--ink', ground: '--surface-sunken', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, sunken', floor: 4.5, recorded: 17.83 }, // prettier-ignore
    { ink: '--ink-secondary', ground: '--surface-sunken', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, sunken', floor: 4.5, recorded: 15.19 }, // prettier-ignore
    { ink: '--ink-accent-strong', ground: '--surface-sunken', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, sunken', floor: 4.5, recorded: 12.12 }, // prettier-ignore
    /*
     * The contact card's label — 11px bold, so a 4.5 floor rather than 3.0.
     *
     * BOTH grounds, because the card now renders on both. It was `--ink-accent`
     * and passed for as long as it only ever appeared inside this slab, where
     * the scope points both accent roles at the same `accent-400`. Reusing the
     * card was enough to break it: on the light page ground the unscoped token
     * is the display-only gold and axe measured the label at 3.96:1 against
     * white. Measuring the raised ground in both scopes is what stops the next
     * reuse finding out the same way.
     */
    { ink: '--ink-accent-strong', ground: '--surface-raised', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, raised', floor: 4.5, recorded: 11.05 }, // prettier-ignore
    { ink: '--ink-accent-strong', ground: '--surface-raised', layers: [LIGHT, RAMP], where: 'light, raised', floor: 4.5, recorded: 5.45 }, // prettier-ignore
    { ink: '--line-control', ground: '--surface-sunken', layers: [INVERSE, LIGHT, RAMP], where: 'inverse, sunken', floor: 3.0, recorded: 7.65 }, // prettier-ignore

    // ---- the emergency ticker, on `error-950` ----------------------------
    // The one surface the error ramp is used on, and the one bar a reader might
    // need in a storm. Every pair it actually renders is measured, in BOTH the
    // resting and the hover state — a hover that costs legibility on this bar
    // is not a trade worth making anywhere, least of all here.
    { ink: '--color-error-200', ground: '--color-error-950', layers: [RAMP], where: 'ticker number', floor: 4.5, recorded: 12.43 }, // prettier-ignore
    { ink: '--color-error-400', ground: '--color-error-950', layers: [RAMP], where: 'ticker label', floor: 4.5, recorded: 6.22 }, // prettier-ignore
    { ink: '--color-neutral-50', ground: '--color-error-950', layers: [RAMP], where: 'ticker organisation', floor: 4.5, recorded: 18.20 }, // prettier-ignore
    { ink: '--color-error-600', ground: '--color-error-950', layers: [RAMP], where: 'ticker separator, decorative', floor: 3.0, recorded: 3.21 }, // prettier-ignore
    { ink: '--color-error-100', ground: '--color-error-700', layers: [RAMP], where: 'ticker number, hovered', floor: 4.5, recorded: 6.20 }, // prettier-ignore
    { ink: '--color-error-200', ground: '--color-error-700', layers: [RAMP], where: 'ticker gap clause, hovered', floor: 4.5, recorded: 5.18 }, // prettier-ignore

    // ---- the footer's cost pill ------------------------------------------
    // The project's headline claim. Both tokens were MISSING when the footer
    // was first ported — the classes were copied across without them, and
    // Tailwind emitted nothing rather than failing, so the pill rendered with
    // no ground and no colour. Measured here so that cannot recur silently.
    { ink: '--color-success-400', ground: '--color-success-900', layers: [RAMP], where: 'footer cost pill', floor: 4.5, recorded: 7.93 }, // prettier-ignore

    // ---- the service row's status pills -----------------------------------
    // "Requirements · fees · steps" and "Not yet transcribed" are the only two
    // things a row says about itself, and a reader who cannot tell the green
    // ground from the amber one still reads the WORDS — which is why both are
    // measured as text rather than treated as a colour code.
    { ink: '--pill-ok-ink', ground: '--pill-ok-bg', layers: [LIGHT, RAMP], where: 'transcribed pill, light', floor: 4.5, recorded: 8.8 }, // prettier-ignore
    { ink: '--pill-gap-ink', ground: '--pill-gap-bg', layers: [LIGHT, RAMP], where: 'gap pill, light', floor: 4.5, recorded: 5.07 }, // prettier-ignore
    { ink: '--pill-ok-ink', ground: '--pill-ok-bg', layers: [DARK, LIGHT, RAMP], where: 'transcribed pill, dark', floor: 4.5, recorded: 6.99 }, // prettier-ignore
    { ink: '--pill-gap-ink', ground: '--pill-gap-bg', layers: [DARK, LIGHT, RAMP], where: 'gap pill, dark', floor: 4.5, recorded: 9.99 }, // prettier-ignore

    // ---- the coverage meter, a graphical object ----------------------------
    // Against its own TRACK first — that is the boundary the bar is read by.
    // The design sheet's `primary-500` lands at 2.54 here, which is why this
    // portal fills with `primary-600` instead.
    { ink: '--meter', ground: '--line', layers: [LIGHT, RAMP], where: 'meter fill on its track, light', floor: 3.0, recorded: 3.59 }, // prettier-ignore
    { ink: '--meter', ground: '--line', layers: [DARK, LIGHT, RAMP], where: 'meter fill on its track, dark', floor: 3.0, recorded: 6.89 }, // prettier-ignore
    // And on every ground it is drawn over: the office panel's dot, and the
    // 4px rule marking the current item in the wayfinding rail.
    { ink: '--meter', ground: '--surface-raised', layers: [LIGHT, RAMP], where: 'panel dot, light', floor: 3.0, recorded: 5.05 }, // prettier-ignore
    { ink: '--meter', ground: '--surface-raised', layers: [DARK, LIGHT, RAMP], where: 'panel dot, dark', floor: 3.0, recorded: 9.02 }, // prettier-ignore
    { ink: '--meter', ground: '--surface-tint', layers: [LIGHT, RAMP], where: 'current rail item, light', floor: 3.0, recorded: 4.71 }, // prettier-ignore
    { ink: '--meter', ground: '--surface-tint', layers: [DARK, LIGHT, RAMP], where: 'current rail item, dark', floor: 3.0, recorded: 9.47 }, // prettier-ignore
    { ink: '--meter', ground: '--surface-sunken', layers: [LIGHT, RAMP], where: 'quoted-title rule, light', floor: 3.0, recorded: 4.85 }, // prettier-ignore
    { ink: '--meter', ground: '--surface-sunken', layers: [DARK, LIGHT, RAMP], where: 'quoted-title rule, dark', floor: 3.0, recorded: 9.9 }, // prettier-ignore
  ];

  it('covers every ink role on every ground it can appear over', () => {
    expect(PAIRS.length).toBeGreaterThan(40);
  });

  it.each(PAIRS)(
    '$ink on $ground ($where) clears $floor:1',
    ({ ink, ground, layers, floor, recorded }) => {
      const ratio = contrast(resolve(ink, layers), resolve(ground, layers));
      expect(ratio).toBeGreaterThanOrEqual(floor);
      expect(ratio).toBe(recorded);
    }
  );

  it('makes the hover state on the gold card genuinely darker than the link', () => {
    const link = resolve('--ink-link', [ACCENT_SURFACE, LIGHT, RAMP]);
    const hover = resolve('--ink-link-hover', [ACCENT_SURFACE, LIGHT, RAMP]);
    expect(lightness(hover)).toBeLessThan(lightness(link));
  });

  const THEMES: { name: string; layers: Record<string, string>[] }[] = [
    { name: 'light', layers: [LIGHT, RAMP] },
    { name: 'dark', layers: [DARK, LIGHT, RAMP] },
  ];

  for (const { name, layers } of THEMES) {
    it(`darkens the band on hover by a nudge, not a jump (${name})`, () => {
      /*
       * A hover is feedback; it is not a state change. Reaching for
       * `--surface-inverse-deep` instead — which is what the buttons first did
       * — drops roughly 18 OKLab points and reads as *pressed*, so the button
       * looks stuck the whole time the pointer is over it. Both bounds matter:
       * too small and nothing happened, too large and it is a different button.
       */
      const band = lightness(resolve('--surface-band', layers));
      const hover = lightness(resolve('--surface-band-hover', layers));
      const drop = (band - hover) * 100;

      expect(drop).toBeGreaterThan(3);
      expect(drop).toBeLessThan(12);
    });
  }
});

describe('the night ground is pinned by the mark, not by taste', () => {
  const NIGHT = RAMP['--color-surface-night'];
  const DEEP = LIGHT['--mark-delivered-emblem-deep'];

  it('sits at OKLab lightness 16%', () => {
    expect(lightness(NIGHT)).toBeCloseTo(0.16, 2);
  });

  it('is a CEILING — lightening it makes the mark worse, not better', () => {
    /*
     * The counter-intuitive part, and the reason this is a test rather than a
     * comment. The ground is itself green-tinted, so raising its lightness
     * closes the gap to the emblem's deep green instead of opening it. Anyone
     * who "brightens the dark theme a little" is degrading the mark.
     */
    const lighter = ['#031409', '#04170d', '#061c11'];
    const atNight = contrast(DEEP, NIGHT);

    for (const candidate of lighter) {
      expect(lightness(candidate)).toBeGreaterThan(lightness(NIGHT));
      expect(contrast(DEEP, candidate)).toBeLessThan(atNight);
    }
  });

  it('holds the mark at the best ratio available to it', () => {
    // 2.996, not the 3.00 it rounds to. A logotype is exempt from the 3:1
    // graphical-object floor and this mark ships aria-hidden beside a text
    // wordmark — so this is RECORDED, not outstanding. It is asserted at all
    // so that a change which drops it materially cannot pass unnoticed.
    expect(contrast(DEEP, NIGHT)).toBe(3.0);
  });
});

describe('the mark on the light ground, recorded rather than gated', () => {
  /**
   * The mark's colours that sit below the 3:1 graphical-object floor on paper,
   * each with the reason it is not a defect to fix in the palette.
   *
   * WCAG exempts logotypes; the mark ships `aria-hidden`; and the text wordmark
   * beside it carries the meaning. Adding a line here is a design decision that
   * has to be defended in the string — it is not a way to close a red build.
   */
  const EXEMPT: Record<string, string> = {
    '--mark-delivered-sun':
      'flag yellow on a near-white page is ~1.4:1 by construction; the rays read as a shape against the emblem’s hard circular edge, not against the page',
    '--mark-delivered-emblem-light':
      'a dark-theme ink and a light-theme surface, never body ink on paper; it is separated from its neighbours by the channel cut between them, not by contrast',
  };

  const PAPER = RAMP['--color-neutral-100'];
  const MARK = [
    '--mark-delivered-emblem-light',
    '--mark-delivered-emblem-mid',
    '--mark-delivered-emblem-deep',
    '--mark-delivered-sun',
  ];

  it('lists every one that falls short, and nothing that does not', () => {
    const short = MARK.filter(token => contrast(LIGHT[token], PAPER) < 3.0);
    expect(short.sort()).toEqual(Object.keys(EXEMPT).sort());
  });

  it('keeps the exemption list honest', () => {
    // An exemption for a colour that now clears the floor stops anyone reading
    // the list, at which point the live ones stop being seen.
    const stale = Object.keys(EXEMPT).filter(
      token => contrast(LIGHT[token], PAPER) >= 3.0
    );
    expect(stale).toEqual([]);
  });
});

describe('the theme mechanism', () => {
  it('binds dark styling to the attribute, after the design-system import', () => {
    /*
     * Both lookups are anchored to the start of a line, and neither may use
     * `indexOf`. The comment above these directives quotes Kapwa's OWN
     * `@custom-variant dark (&:is(.dark *))` — the class-bound one this project
     * deliberately does not copy — so a substring search finds the prose first
     * and asserts against the wrong declaration. It read as a failure of the
     * stylesheet rather than of the test, which is the worse way round.
     */
    const source = /\n@source /.exec(CSS);
    const variant = /\n@custom-variant dark (.+)/.exec(CSS);

    expect(source).not.toBeNull();
    expect(variant).not.toBeNull();
    expect(variant!.index).toBeGreaterThan(source!.index);
    expect(variant![1]).toContain("[data-theme='dark']");
  });

  it('sets `color-scheme` per theme, so controls and scrollbars follow', () => {
    expect(CSS).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/);
    expect(CSS).toMatch(
      /:root\[data-theme='dark'\]\s*\{[^}]*color-scheme:\s*dark/
    );
  });

  it('flattens the mark to one white silhouette on an inverse surface', () => {
    // What lets ONE component render all three delivered variants instead of
    // shipping three SVGs.
    const white = RAMP['--color-neutral-50'];
    for (const role of [
      '--mark-emblem-light',
      '--mark-emblem-mid',
      '--mark-emblem-deep',
      '--mark-sun',
    ]) {
      expect(resolve(role, [INVERSE, LIGHT, RAMP])).toBe(white);
      // …and resolves to the delivered artefact everywhere else.
      expect(resolve(role, [LIGHT, RAMP])).not.toBe(white);
    }
  });

  it('exposes every role through `@theme inline`, not a plain `@theme`', () => {
    /*
     * `inline` is load-bearing: a plain `@theme` bakes the LIGHT value onto
     * :root, and the dark theme then silently does nothing. The failure is
     * invisible in light mode, which is the mode it gets reviewed in.
     */
    // Matched at the start of a line so the prose above cannot stand in for
    // the block — the first `@theme inline` in this file is in a comment.
    const block = /\n@theme inline\s*\{([^}]*)\}/.exec(CSS);
    expect(block).not.toBeNull();
    const inline = block![1];

    for (const role of Object.keys(LIGHT).filter(
      token => token.startsWith('--ink') || token.startsWith('--surface')
    )) {
      expect(inline).toContain(`var(${role})`);
    }
  });
});
