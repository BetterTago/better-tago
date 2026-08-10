import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lguConfig } from '@/lib/lgu-config';
import { localeState } from '@/test/intl-mock';
import { HotlineTicker } from './HotlineTicker';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/**
 * 🔴 **Every value here is unmistakably synthetic, and that is a rule rather
 * than a style.**
 *
 * A fixture is where an invented civic fact escapes review. `+63 000 000 0000`
 * cannot be mistaken for a real Tago number by a reader, a reviewer, or a
 * future contributor copying a test into a page; `+63 917 555 0142` could be,
 * and that is the whole difference. No real person, no plausible local number,
 * and above all no figure from another LGU.
 */
const SYNTHETIC_HOTLINES = Array.from({ length: 12 }, (_, index) => ({
  label: `EXAMPLE OFFICE ${index + 1}`,
  numbers: [`+63 000 000 ${String(index).padStart(4, '0')}`],
  role: 'EXAMPLE ROLE',
  hours: 'not stated',
  verification: 'V2' as const,
  source: {
    label: 'EXAMPLE SOURCE',
    url: null,
    checkedAt: '2026-01-01',
  },
}));

/** The populated state: numbers obtained, status says so. */
const POPULATED = {
  ...lguConfig.emergency,
  municipalHotlines: SYNTHETIC_HOTLINES,
  status: 'obtained' as const,
};

/* The gap state, which is no longer the live one — built as a fixture so the
   branch stays exercised. Six agencies were published on 2026-08-10; before
   that this was what every reader saw. */
const NOT_OBTAINED = {
  ...lguConfig.emergency,
  municipalHotlines: [],
  status: 'not-obtained' as const,
};

describe('HotlineTicker — the state that ships today', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('publishes the national line as a dialable link', async () => {
    const { container } = render(await HotlineTicker());

    const call = container.querySelector('a[href^="tel:"]');
    expect(call).not.toBeNull();
    expect(call?.getAttribute('href')).toBe(
      `tel:${lguConfig.emergency.nationalLine}`
    );
    // The accessible name carries the ORGANISATION as well as the digits —
    // "911" read alone tells a screen-reader user nothing about what they are
    // about to dial.
    expect(call?.getAttribute('aria-label')).toMatch(/national/i);
  });

  it('states the gap and links the section WHEN nothing has been obtained', async () => {
    // From a fixture: the live config carries six agencies since 2026-08-10.
    const { container } = render(
      await HotlineTicker({ emergency: NOT_OBTAINED })
    );

    expect(container.textContent).toMatch(/no municipal hotline/i);
    expect(container.querySelector('a[href="#emergency"]')).not.toBeNull();
  });

  it('carries the obtained agencies, and drops the gap clause', async () => {
    const { container } = render(await HotlineTicker());

    expect(lguConfig.emergency.status).toBe('obtained');
    expect(container.textContent).not.toMatch(/no municipal hotline/i);
    // Every agency, and every number each one publishes.
    for (const hotline of lguConfig.emergency.municipalHotlines) {
      expect(container.textContent).toContain(hotline.label);
      for (const number of hotline.numbers) {
        expect(container.textContent).toContain(number);
      }
    }
  });

  it('🔴 renders NO municipal number while the status is `not-obtained`', async () => {
    /*
     * The load-bearing assertion in this file. A wrong number in an emergency
     * is worse than no number at all, and the failure mode is not somebody
     * typing a fake one — it is a half-obtained list leaking through while the
     * status still says the numbers are not confirmed.
     *
     * Driven from a fixture now that the live status is `obtained`; the rule
     * matters most for the state the config is NOT in.
     */
    const { container } = render(
      await HotlineTicker({ emergency: NOT_OBTAINED })
    );
    // Deduplicated: the marquee's echo run repeats every link by design, so
    // what is asserted here is the SET of numbers the bar can dial, not the
    // count of anchors in the DOM.
    const dialable = new Set(
      [...container.querySelectorAll('a[href^="tel:"]')].map(link =>
        link.getAttribute('href')
      )
    );

    expect([...dialable]).toEqual([`tel:${lguConfig.emergency.nationalLine}`]);
  });

  it('🔴 refuses a stale list while the status is not `obtained`', async () => {
    // Numbers present, status not yet confirmed → nothing municipal renders.
    const { container } = render(
      await HotlineTicker({
        emergency: {
          ...lguConfig.emergency,
          municipalHotlines: SYNTHETIC_HOTLINES,
          status: 'requested',
        },
      })
    );

    expect(container.textContent).not.toContain('EXAMPLE OFFICE 1');
    expect(container.textContent).toMatch(/no municipal hotline/i);
  });
});

describe('HotlineTicker — fully populated, at density', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('renders every obtained hotline as its own dialable link', async () => {
    const { container } = render(await HotlineTicker({ emergency: POPULATED }));

    /*
     * Twelve municipal numbers plus the national line — counted over the TAB
     * ORDER, not over the DOM.
     *
     * The echo run repeats every link, because a visible number that cannot be
     * dialled is worse than no echo at all. What it must not repeat is the tab
     * stops, so its copies are `tabIndex={-1}` and this count excludes them.
     */
    const tabbable = [
      ...container.querySelectorAll('a[href^="tel:"]:not([tabindex="-1"])'),
    ];
    expect(tabbable).toHaveLength(SYNTHETIC_HOTLINES.length + 1);
  });

  it('drops the gap clause once the numbers are in', async () => {
    const { container } = render(await HotlineTicker({ emergency: POPULATED }));
    expect(container.textContent).not.toMatch(/no municipal hotline/i);
  });

  it('🔴 echoes every link too — a visible number is always dialable', async () => {
    /*
     * The regression this exists for, reported from the running site.
     *
     * The echo shipped once as inert `<span>`s. Visually identical, so the loop
     * looked perfect — and for HALF of every cycle the numbers under the
     * reader's finger were dead text, with nothing to distinguish them from the
     * live ones. On an emergency bar that is the worst possible failure, and it
     * is invisible to any test that only counts links.
     *
     * So: both runs carry real `tel:` anchors, and the echo gives up only its
     * voice and its tab stops.
     */
    const { container } = render(await HotlineTicker({ emergency: POPULATED }));

    const runs = container.querySelectorAll('.hotline-run');
    expect(runs).toHaveLength(2);

    const echo = container.querySelector('.hotline-echo');
    expect(echo).not.toBeNull();
    expect(echo?.getAttribute('aria-hidden')).toBe('true');

    // Every number in the echo is a real link, not an inert copy…
    const echoLinks = [
      ...(echo?.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]') ?? []),
    ];
    expect(echoLinks).toHaveLength(SYNTHETIC_HOTLINES.length + 1);
    // …and every one of them is out of the tab order, which is what keeps
    // `aria-hidden-focus` passing and the numbers from being tabbed twice.
    expect(
      echoLinks.every(link => link.getAttribute('tabindex') === '-1')
    ).toBe(true);

    // Same copy, so the two runs measure identically and `-50%` steps exactly
    // one of them. A shorter echo is a visible jump every cycle.
    expect(echo?.textContent).toBe(runs[0].textContent);
  });

  it('renders in Filipino too, which is the sizing case', async () => {
    localeState.current = 'fil';
    const { container } = render(await HotlineTicker({ emergency: POPULATED }));
    // Reaching the real fil.json is the point: a missing key throws here rather
    // than rendering the key back at a reader.
    expect(container.textContent).toContain('Emerhensiya');
  });
});

describe('HotlineTicker — the marquee is a progressive enhancement', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('🔴 starts still, and only moves once an overflow is MEASURED', async () => {
    /*
     * `data-marquee` is what switches the animation on, and `TickerViewport`
     * sets it only after `ResizeObserver` finds one run genuinely wider than
     * the bar. jsdom lays nothing out, so the attribute is absent here — which
     * is exactly the state a reader with JavaScript disabled gets: a static,
     * scrollable, fully readable row.
     *
     * Asserted rather than assumed, because the failure it guards against is
     * silent — a marquee gated on a breakpoint instead of a measurement
     * animates a row that fits, and sits still on one that does not.
     */
    const { container } = render(await HotlineTicker());

    const viewport = container.querySelector('.hotline-viewport');
    expect(viewport).not.toBeNull();
    expect(viewport?.getAttribute('data-marquee')).toBeNull();
    expect(container.querySelector('.hotline-track')).not.toBeNull();
  });

  it('carries no colour literal of its own', async () => {
    // Colour reaches this component only through named tokens; the ticker's
    // ground is the one surface the error ramp is used on, and every pair it
    // renders is measured in theme-tokens.test.ts.
    const source = (await import('node:fs')).readFileSync(
      'src/components/layout/HotlineTicker.tsx',
      'utf8'
    );
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\b(?:rgb|hsl|oklch)\(/i);
  });
});
