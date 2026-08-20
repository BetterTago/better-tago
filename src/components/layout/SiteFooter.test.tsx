import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lguConfig } from '@/lib/lgu-config';
import { localeState } from '@/test/intl-mock';
import { SiteFooter } from './SiteFooter';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/*
 * `getVisitCount` carries `'use cache'` + `cacheLife('visits')`, and `cacheLife`
 * throws outside the Next runtime — the same wall `AdvisoryBar.test.tsx`
 * documents for `getManifest`. Stubbed rather than worked around, because what
 * this file tests is the Contribute column and the badge rail, not the store.
 *
 * `null` is the deliberate value: it is the state every developer machine and
 * every unconfigured deployment is in, and it exercises the branch that must
 * render "— visits" rather than a zero. The store's own behaviour is pinned in
 * `src/lib/visits.test.ts`, against the uncached half where it can be reached.
 */
vi.mock('@/lib/visits', () => ({
  getVisitCount: () => Promise.resolve(null),
}));

/*
 * `NavLink` reaches `@/i18n/navigation`, whose `Link` is built by next-intl's
 * CLIENT navigation factory and pulls in `next/navigation` — a module that does
 * not resolve outside a Next request. Only the two column lists route through
 * it; what this file tests is the Contribute column, so the locale-aware Link
 * is stood in for by a plain anchor rather than the whole router being faked.
 */
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));

// `useTranslations` is the CLIENT hook `NavLink` and `ExternalNavLink` call; the
// server mock above does not cover it.
vi.mock('next-intl', async () => {
  const { intlClientMock } = await import('@/test/intl-mock');
  return intlClientMock();
});

/**
 * 🔴 An unmistakably synthetic repository, for the same reason every fixture in
 * this codebase is: a plausible-looking URL is how an invented fact escapes
 * review. `example.invalid` is reserved by RFC 2606 and can never resolve.
 */
const WITH_REPOSITORY = {
  ...lguConfig.portal,
  repository: 'https://example.invalid/better-tago',
};

/**
 * The gap branch. `portal.repository` is set today, so this state does not
 * ship — which is exactly why it is built here. It is the state that returns
 * the day a repository is withdrawn or a new portal is stood up, and the worst
 * possible day to discover the branch was never designed is that one.
 */
const WITHOUT_REPOSITORY = {
  ...lguConfig.portal,
  repository: null,
};

describe('SiteFooter — the Contribute column', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('renders both contributor buttons when the repository is published', async () => {
    const { container } = render(await SiteFooter({ portal: WITH_REPOSITORY }));

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>(
        'a[href="https://example.invalid/better-tago"]'
      ),
    ];
    // Two buttons plus the bottom rail's Source Code link, all one destination
    // — volunteering on this project IS the repository.
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('🔴 states the gap instead of an empty column when it is null', async () => {
    /*
     * TAGO-113's criterion, and the reason it is worth a test rather than a
     * guard: the null branch rendered an EMPTY `<ul>` until 2026-08-10. Nothing
     * crashed and nothing lied — a reader simply saw a "Contribute" heading
     * with nothing under it, and no way to tell a missing repository from a
     * broken page. A silent omission is the one failure mode this project's own
     * rules single out.
     */
    const { container } = render(
      await SiteFooter({ portal: WITHOUT_REPOSITORY })
    );

    expect(container.textContent).toMatch(/source code is not published yet/i);
  });

  it('🔴 links no repository at all while it is null', async () => {
    /*
     * The other half, and the one a stated gap could still get wrong: stating
     * the absence is no use if a button beside it points at a repository that
     * does not exist. Asserted over EVERY link in the footer rather than over
     * the Contribute column alone, because the bottom rail carries a third one.
     */
    const { container } = render(
      await SiteFooter({ portal: WITHOUT_REPOSITORY })
    );

    const hrefs = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href]'),
    ].map(link => link.getAttribute('href') ?? '');

    expect(hrefs.some(href => /github\.com\/BetterTago/i.test(href))).toBe(
      false
    );
    expect(hrefs.some(href => href.includes('example.invalid'))).toBe(false);
  });

  it('renders the gap in Filipino too, from the catalogue', async () => {
    // Reaching the real fil.json is the point: a missing key throws here rather
    // than rendering the key back at a reader.
    localeState.current = 'fil';
    const { container } = render(
      await SiteFooter({ portal: WITHOUT_REPOSITORY })
    );

    expect(container.textContent).toMatch(/source code/i);
    expect(container.textContent).not.toContain('footer.repositoryGap');
  });
});
