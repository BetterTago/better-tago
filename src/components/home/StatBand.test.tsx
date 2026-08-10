import { render } from '@testing-library/react';
import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAP_PATHS, type GapPath, lguConfig } from '@/lib/lgu-config';
import { localeState } from '@/test/intl-mock';
import { resolveServer } from '@/test/resolve-server';
import { StatBand } from './StatBand';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/*
 * next-intl's locale-aware `Link` reaches `next/navigation`, which only resolves
 * inside a Next request. A plain anchor is enough here: what these tests assert
 * about it is the DESTINATION, and the locale prefixing is next-intl's own
 * behaviour rather than this component's.
 */
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * The fully-populated band, from a SYNTHETIC fixture.
 *
 * The figures are deliberately absurd — 12,345 residents is not a claim about
 * Tago and could not be mistaken for one. A fixture carrying a plausible
 * population is how an invented civic fact gets copied out of a test and onto a
 * page, and this project's whole argument is that it does not do that.
 */
const POPULATED = {
  ...lguConfig.lgu,
  population: 12345,
  households: 2345,
  barangayCount: 12,
  censusYear: 2020,
  landAreaKm2: 99.99,
  sources: {
    ...lguConfig.lgu.sources,
    population: {
      label: 'EXAMPLE CENSUS RELEASE',
      url: 'https://example.invalid/census',
      checkedAt: '2026-01-01',
      note: 'A synthetic source, used only to render the populated state in a test fixture.',
    },
    households: {
      label: 'EXAMPLE CENSUS RELEASE',
      url: 'https://example.invalid/census',
      checkedAt: '2026-01-01',
      note: 'A synthetic source, used only to render the populated state in a test fixture.',
    },
    barangayCount: {
      label: 'EXAMPLE BARANGAY LIST',
      url: 'https://example.invalid/barangays',
      checkedAt: '2026-01-01',
      note: 'A synthetic source, used only to render the populated state in a test fixture.',
    },
    landAreaKm2: {
      label: 'EXAMPLE CADASTRAL RECORD',
      url: 'https://example.invalid/land',
      checkedAt: '2026-01-01',
      note: 'A synthetic source, used only to render the populated state in a test fixture.',
    },
  },
};

/** What a gap surface may never put where a figure belongs. */
const PLACEHOLDERS = ['—', '–', 'N/A', 'NA', 'TBD', 'TBA'];

describe('StatBand — the state that ships today', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('renders all four figures, each with its citation', async () => {
    /*
     * All four cells carry a value as of 2026-08-10 — population, income class,
     * barangay count and land area. Three of them are `V1`, reached through a
     * tertiary path because the national statistics authority's own record
     * answers HTTP 403 to an automated request, and every one of them names
     * both the primary record and that path in its source note.
     */
    const { container } = render(
      await resolveServer(await StatBand({ locale: 'en' }))
    );

    expect(container.textContent).toContain('40,097');
    expect(container.textContent).toContain(lguConfig.lgu.incomeClass);
    expect(container.textContent).toContain('24');
    // Two decimals kept: 253 is a different, unsourced figure.
    expect(container.textContent).toContain('253.28');
    expect(container.textContent).toMatch(/km²/);

    // The captions, in the shape asked for.
    expect(container.textContent).toContain('2024 census · PSA');
    expect(container.textContent).toContain('2nd municipal income class');
    expect(container.textContent).toMatch(/5\.13% of the province/);

    /*
     * 🔴 And the one that is an ABSENCE rather than a figure.
     *
     * The urban/rural split is published only on the national statistics
     * authority's PSGC record, which answers HTTP 403 to an automated request,
     * and appears on no other source this project can reach. A caption reading
     * "18 urban, 6 rural" would be invented — under a real figure, in the same
     * typeface, which is exactly how a guess acquires the authority of a fact.
     */
    expect(container.textContent).toContain('Urban/rural split not obtained');
    expect(container.textContent).not.toMatch(/\d+ urban/);
  });

  it('🔴 every cell either carries a value or is in the register', () => {
    /*
     * The contract this band actually has to keep, and the reason it cannot be
     * tested by nulling a figure in a fixture: `lgu-config.ts` refuses to parse
     * a null without a `pending` entry, so "a figure is missing and the
     * register does not know" is a state the configuration cannot reach. A
     * fixture that fakes it is testing an impossible world.
     *
     * So the assertion is the invariant itself, read off the real config: for
     * every cell, either the value is there, or the register explains it.
     * Nothing in between, which is what stops a dash ever appearing.
     */
    for (const key of [
      'population',
      'incomeClass',
      'barangayCount',
      'landAreaKm2',
    ] as const) {
      const value = lguConfig.lgu[key];
      const registered = GAP_PATHS.includes(`lgu.${key}` as GapPath);
      expect(
        value !== null || registered,
        `lgu.${key} is null and not in the register`
      ).toBe(true);
      // And never both — a citation beside a stated gap is two claims.
      expect(value !== null && registered).toBe(false);
    }
  });

  it('hands GapNotice the register path for a figure it does not have', async () => {
    /*
     * The wiring, checked without resolving: `GapNotice` reads the register
     * from module state and THROWS for a path that is not in it, which is
     * deliberate — an invisible gap is the failure the register exists to
     * prevent. So this inspects the element the band emits rather than its
     * output, and `GapNotice.test.tsx` proves separately that any real register
     * path renders verbatim. Together they cover the branch; neither does
     * alone.
     */
    const missing = { ...lguConfig.lgu, population: null };
    const tree = await StatBand({ locale: 'en', lgu: missing });

    const notices: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const props = node.props as { path?: string; children?: unknown };
      if (typeof node.type === 'function' && props.path)
        notices.push(props.path);
      if (props.children !== undefined) walk(props.children);
    };
    walk(tree);

    expect(notices).toContain('lgu.population');
  });

  it('🔴 renders no placeholder, dash or zero in place of a figure', async () => {
    /*
     * The single most important assertion about this band. A reader learns more
     * from one that admits what it does not know than from four confident
     * figures of unknown provenance — but only if the absence is a SENTENCE and
     * not a dash.
     *
     * Scanned per ELEMENT rather than over the whole text, because the
     * register's own prose legitimately contains em dashes and a substring scan
     * would fail on those while missing the thing that matters.
     */
    const { container } = render(
      await resolveServer(await StatBand({ locale: 'en' }))
    );

    const offenders = [...container.querySelectorAll('*')]
      .filter(node => node.children.length === 0)
      .map(node => node.textContent?.trim() ?? '')
      .filter(text => PLACEHOLDERS.includes(text) || text === '0');

    expect(offenders).toEqual([]);
  });

  it('renders no register link while nothing is missing', () => {
    // All four cells carry a value today, so there is nothing to link to — and
    // a permanent "see what is missing" beside four complete figures would be
    // exactly the kind of decoration this portal does not do.
    expect(
      ['population', 'incomeClass', 'barangayCount', 'landAreaKm2'].every(
        key => lguConfig.lgu[key as 'population'] !== null
      )
    ).toBe(true);
  });
});

describe('StatBand — fully populated', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('renders every figure with its caption, and no gap notice at all', async () => {
    const { container } = render(
      await resolveServer(await StatBand({ locale: 'en', lgu: POPULATED }))
    );

    // The server renders the true value; CountUp only animates up to what is
    // already in the HTML, so nothing ever publishes "0 residents".
    expect(container.textContent).toContain('12,345');
    expect(container.textContent).toContain('99.99');

    /*
     * The captions are fixed strings, not `source.label`.
     *
     * They changed on 2026-08-10: a caption now says the one thing a reader
     * wants beside the number — the census and the agency, the share of the
     * province — rather than a repository label and a retrieval date. The full
     * citation did not disappear; it moved to where it can carry its reasoning,
     * `lgu.sources.<field>.note`, and it surfaces on the register.
     */
    expect(container.textContent).toContain('2024 census · PSA');
    // Derived and shown as a share: 99.99 / 4932.70 = 2.03%.
    expect(container.textContent).toMatch(/2\.03% of the province/);

    /*
     * Households is no longer a cell — the instruction replaced it with income
     * class. Asserted on the LABEL, not the value: "12,345" contains "2,345",
     * so a substring check on the number is not a check at all.
     */
    expect(container.textContent).not.toContain('Households');

    // Nothing is missing, so nothing links the register.
    expect(container.querySelector('a[href$="/gaps"]')).toBeNull();
  });

  it('moves a figure across on a configuration change alone', async () => {
    /*
     * Closing a gap must require no code change, and this is what actually
     * happened on 2026-08-10: four values were filled in the configuration,
     * their `pending` entries were deleted, and the band moved them out of the
     * gap list and into cells with no component edited at all.
     *
     * Asserted here as the reverse — a synthetic figure the real config does
     * not carry still renders, from the fixture alone.
     */
    const { container } = render(
      await resolveServer(await StatBand({ locale: 'en', lgu: POPULATED }))
    );

    expect(container.textContent).toContain('12,345');
    expect(container.textContent).toContain('99.99');
  });
});
