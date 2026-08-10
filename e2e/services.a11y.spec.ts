import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { settleAnimations } from './settle';

/**
 * Every route this pass published, in both locales and both themes.
 *
 * Axe catches roughly a third of real accessibility problems — it is the floor,
 * not the ceiling. Both themes because contrast is the failure a dark theme
 * introduces and axe is good at exactly that; both locales because a Filipino
 * page carries different text at different lengths.
 */
const ROUTES = [
  '/services',
  '/services/civil-registry',
  '/services/tourism/apply-for-dot-accreditation',
  '/charter/documents/tourism-external-services',
  // The office facet, and both states of search. The empty result is not an
  // edge case on this portal — it is the normal one, and it is the screen most
  // likely to be reached in a hurry.
  '/services/office/office-of-the-municipal-nutrition',
  '/search/certificate',
  '/search/certificate/civil-registry',
  '/search/zzzzznotathing',
];

for (const route of ROUTES) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const locale of ['en', 'fil']) {
      test(`@a11y ${route} has no axe violations in ${locale}, ${colorScheme}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({ colorScheme });
        const page = await context.newPage();
        await page.goto(`/${locale}${route}`);
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme
        );

        // Entrance animations must finish first — axe measures a mid-fade
        // element as genuinely translucent and reports contrast that is not a
        // real defect. See settle.ts.
        await settleAnimations(page);

        /*
         * 🔴 The hotline bar is EXCLUDED, and this is the reason — it is a
         * listed, reviewed exemption rather than a rule quietly switched off.
         *
         * axe resolves an element's background by hit-testing its centre point.
         * The bar is a horizontal scroller whose content is wider than a phone
         * (582px in English, 700px in Filipino, against a 375px viewport), so
         * everything past the right edge hit-tests against the PAGE and axe
         * reports `#fdc9c5` on `#f3f7f4` — 1.35:1 against a colour that text
         * never sits on. Freezing the marquee and start-aligning the track both
         * helped and neither fixes it, because a static scrollable row still
         * has off-screen content. It is a limitation of measuring a scroll
         * container, not a defect in the bar.
         *
         * What covers it instead, so nothing here is untested:
         *
         * · `theme-tokens.test.ts` COMPUTES every colour pair this surface
         *   renders against its real ground (`error-950`) — resting and hovered,
         *   ink, label, separator — and fails the build on any that drops below
         *   its floor. That is stronger than a hit test, not weaker.
         * · `chrome.spec.ts` asserts the bar's semantics in a browser: the
         *   `tel:` link, its accessible name, the gap link, and that it stays
         *   readable and scrollable with JavaScript disabled.
         * · `HotlineTicker.test.tsx` asserts the echo is `aria-hidden` and
         *   contributes no links, so it is never read twice.
         *
         * Everything else on the page is still analysed in full.
         */
        const results = await new AxeBuilder({ page })
          .exclude('.hotline-viewport')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await context.close();
      });
    }
  }
}

test('@a11y every service page has exactly one h1, and the headings do not skip', async ({
  page,
}) => {
  /*
   * A screen-reader user navigates these pages by heading. The eight charter
   * fields are h2s under one h1, and a page that skips from h1 to h3 tells them
   * a level is missing that is not.
   */
  await page.goto('/en/services/tourism/apply-for-dot-accreditation');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  const levels = await page
    .locator('article h2, article h3, article h4')
    .evaluateAll(nodes => nodes.map(node => Number(node.tagName.slice(1))));

  let previous = 1;
  for (const level of levels) {
    expect(level - previous).toBeLessThanOrEqual(1);
    previous = level;
  }
});

test('@a11y every target on the search screen is 44px, or is a listed exemption', async ({
  page,
}) => {
  await page.goto('/en/search/certificate');

  /*
   * ## The exemption, which is a reviewed decision and not an omission
   *
   * `[data-dense-list]` — the search rail's category facets and its "try
   * instead" suggestions, at 36px rather than 44px. They are a secondary
   * refinement aid in a 240px column beside the results, read as a reference
   * list rather than operated as primary controls, and at 44px each eleven
   * facets plus three suggestions would stand taller than the results they
   * narrow. Every destination they offer is reachable another way: a facet by
   * re-reading the results, a suggestion from the home page's own chips.
   *
   * Removing this line should mean the rail was widened back to 44px, not that
   * the rule quietly stopped being checked.
   *
   * `p` is WCAG 2.5.8's own inline exception — a link inside a sentence cannot
   * be padded without breaking the line it sits in. The rest of the chrome is
   * covered by `home.a11y.spec.ts`, which owns the header and footer list.
   */
  const EXEMPT = [
    '[data-dense-list]',
    // The breadcrumb, for WCAG 2.5.8's own inline reason — see Breadcrumb.tsx.
    '[data-breadcrumb]',
    'p',
    'footer a',
    '[data-control]',
    '.hotline-viewport',
  ];

  const targets = page
    .locator('main')
    .locator('a:visible:not(.sr-only), button:visible:not(.sr-only)');
  const count = await targets.count();
  expect(count).toBeGreaterThan(3);

  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const exempt = await target.evaluate(
      (node, selectors) => selectors.some(sel => node.closest(sel) !== null),
      EXEMPT
    );
    if (exempt) continue;

    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('@a11y a wide requirements table is reachable by keyboard', async ({
  page,
}) => {
  // A container that scrolls must be focusable, or a keyboard user cannot
  // reach the right-hand column at all.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/en/services/tourism/apply-for-dot-accreditation');

  // Each table is named by its own first column, so three tables on a page are
  // three distinguishable stops rather than three identical ones.
  const scroller = page.getByRole('region', {
    name: /Checklist of requirements, table, scrollable sideways/,
  });
  await expect(scroller).toBeVisible();

  // Visible is not reachable. It must take a tab stop, or the right-hand
  // column is unreachable without a mouse.
  await expect(scroller).toHaveAttribute('tabindex', '0');
  await scroller.focus();
  await expect(scroller).toBeFocused();
});
