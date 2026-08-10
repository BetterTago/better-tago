import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAP_PATHS, gapFor, lguConfig } from '@/lib/lgu-config';
import { localeState } from '@/test/intl-mock';
import { GapNotice } from './GapNotice';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/** Placeholders a gap surface may never put where a reason belongs. */
const PLACEHOLDERS = ['—', '-', '–', 'N/A', 'NA', 'TBD', 'TBA', '0', '?'];

describe('GapNotice', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('has a register to render, and is reading all of it', () => {
    // A register that emptied itself would make every assertion below a green
    // no-op, and the component would look tested while rendering nothing.
    expect(GAP_PATHS.length).toBe(Object.keys(lguConfig.pending).length);
    // The floor came down from ten to five on 2026-08-10, when the
    // population, census year, barangay count and land area were closed at
    // V1. A floor rather than a snapshot: zero means the register is either
    // finished or has been emptied, and those need telling apart.
    expect(GAP_PATHS.length).toBeGreaterThanOrEqual(5);
  });

  it('prints the register entry verbatim, for every gap in it', async () => {
    for (const path of GAP_PATHS) {
      const { container, unmount } = render(await GapNotice({ path }));
      // Verbatim, not summarised: a gap explained one way on a page and another
      // way in the register is two claims about the same absence.
      expect(container.textContent).toContain(gapFor(path).note);
      unmount();
    }
  });

  it('separates a held gap from an unobtained one', async () => {
    /*
     * "We could not get it" and "we have it and are deliberately not publishing
     * it" are different absences. The postal code is the held one: the official
     * site publishes a value that sits outside this province's range, so
     * printing it would propagate an error and correcting it would invent one.
     */
    const { unmount } = render(await GapNotice({ path: 'lgu.postalCode' }));
    expect(screen.getByText(/deliberately not published/i)).toBeInTheDocument();
    unmount();

    render(await GapNotice({ path: 'lgu.households' }));
    expect(screen.getByText(/not obtained yet/i)).toBeInTheDocument();
  });

  it('says when somebody last looked', async () => {
    render(await GapNotice({ path: 'contact.project.email' }));
    // A gap with no date is indistinguishable from nobody having looked.
    expect(screen.getByText(/Last looked for on/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('renders no placeholder anywhere a reason belongs', async () => {
    /*
     * ★ TAGO-114's third negative. Checked per ELEMENT rather than by scanning
     * the text: nine of the register's own notes contain an em dash inside
     * ordinary prose, and a substring scan would fail on those while missing
     * the thing that actually matters — an element whose whole content is a
     * dash standing in for an explanation.
     */
    for (const path of GAP_PATHS) {
      const { container, unmount } = render(await GapNotice({ path }));
      for (const node of container.querySelectorAll('*')) {
        // Leaves only, and not the decorative mark: an `<svg>` carries no text
        // by design, and its emptiness is not a missing explanation.
        if (node.children.length > 0) continue;
        if (node.closest('svg')) continue;
        expect(PLACEHOLDERS).not.toContain(node.textContent?.trim());
      }
      unmount();
    }
  });

  it('is content in the accessibility tree, not decoration', async () => {
    const { container } = render(await GapNotice({ path: 'lgu.households' }));

    // A gap rendered as a disabled control or an aria-hidden ornament is a gap
    // a screen-reader user never learns about.
    expect(container.querySelector('[role="presentation"]')).toBeNull();
    expect(container.querySelector('[disabled]')).toBeNull();
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden).toHaveLength(1);
    expect(hidden[0].tagName.toLowerCase()).toBe('svg');
  });

  it('tells a Filipino reader that the reason is recorded in English', async () => {
    // The register lives in the configuration and is written in English. Every
    // other fallback in this portal is visible, and so is this one.
    localeState.current = 'fil';
    const { container, unmount } = render(
      await GapNotice({ path: 'lgu.households' })
    );
    expect(container.textContent).toMatch(/hindi pa ito naisasalin/i);
    unmount();

    localeState.current = 'en';
    const english = render(await GapNotice({ path: 'lgu.households' }));
    expect(english.container.textContent).not.toMatch(/naisasalin/i);
  });

  it('throws rather than rendering an empty block for an unregistered path', async () => {
    await expect(
      // @ts-expect-error — the union rejects this at compile time; the throw is
      // what catches a path that reaches the component from data instead.
      GapNotice({ path: 'lgu.populaton' })
    ).rejects.toThrow(/no `pending` entry/);
  });

  it('cannot be given a value, or an explanation of its own', () => {
    /*
     * ★ TAGO-114's first and second negatives, as TYPE assertions — the only
     * kind that hold. A component that can fall back to a number is a component
     * that will one day print a guess; a component that accepts prose is one
     * where the page and the register can disagree. If either prop is ever
     * added, these lines compile and `npm run typecheck` fails.
     */
    // @ts-expect-error — no value may be passed.
    void (() => GapNotice({ path: 'lgu.households', value: 40097 }));
    // @ts-expect-error — no alternative wording may be passed.
    void (() => GapNotice({ path: 'lgu.households', reason: 'Coming soon' }));
    // @ts-expect-error — and nothing may be nested inside it.
    void (() => GapNotice({ path: 'lgu.households', children: 'Coming soon' }));
    expect(true).toBe(true);
  });
});
