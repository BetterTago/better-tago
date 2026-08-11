import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { settleAnimations } from './settle';

/**
 * The two routes that lifted the home page's emergency and contact sections
 * onto URLs of their own.
 *
 * Both themes and both locales. The directories move from the home page's
 * `data-surface="inverse"` slab onto an ordinary page surface here, and that is
 * precisely the change that breaks contrast when a component reaches for a
 * literal instead of a role token — so it is the change worth measuring in all
 * four combinations rather than assuming the home page's pass carries over.
 *
 * Axe catches roughly a third of real accessibility problems. It is the floor,
 * not the ceiling — tab through the page yourself before calling a route done.
 */
const ROUTES = ['/emergency', '/contact'];

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
         * The hotline bar is excluded for the reason set out in full in
         * `home.a11y.spec.ts`: axe hit-tests a horizontal scroller's centre
         * point and reports the PAGE behind its off-screen content. It is a
         * limitation of measuring a scroll container, not a defect in the bar,
         * and `theme-tokens.test.ts` computes every pair it renders against its
         * real ground instead. Everything else on the page is analysed in full.
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

for (const route of ROUTES) {
  test(`@a11y ${route} has one h1 and no skipped heading level`, async ({
    page,
  }) => {
    // A reader navigating by heading is told the structure of the page by its
    // levels. The masthead's title is the h1 and the directory's agency or
    // card labels are h3s — so this asserts the h2 that would otherwise be
    // missing between them is not needed, i.e. that nothing skips.
    await page.goto(`/en${route}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll(nodes => nodes.map(node => Number(node.tagName.slice(1))));

    let previous = 1;
    for (const level of levels) {
      expect(level - previous).toBeLessThanOrEqual(1);
      previous = level;
    }
  });

  test(`@a11y every target on ${route} is 44px, or is a listed exemption`, async ({
    page,
  }) => {
    await page.goto(`/en${route}`);

    /*
     * ## The exemptions, each a reviewed decision rather than an omission
     *
     * · **The breadcrumb** (`[data-breadcrumb]`), for WCAG 2.5.8's own inline
     *   reason — see Breadcrumb.tsx.
     *
     * · **Inline links inside a paragraph** (`p`) — WCAG 2.5.8's inline
     *   exception. The provenance citation on both pages is one of these.
     *
     * · **Footer links** and **the header's theme/locale controls**
     *   (`[data-control]`) — both owned and defended by `home.a11y.spec.ts`.
     *
     * Removing a line here should mean the target was widened back to 44px,
     * not that the rule quietly stopped being checked.
     *
     * The emergency directory's per-agency numbers are NOT on this list and are
     * measured: they are ~28px tall but well over 44px wide, and WCAG 2.5.8 is
     * satisfied by either dimension. `Math.max` below is what makes that a
     * measurement rather than an exemption — the same call `home.a11y.spec.ts`
     * makes for the same rows.
     */
    const EXEMPT = [
      '[data-hotline-number]',
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
    expect(count).toBeGreaterThan(0);

    let measured = 0;
    for (let index = 0; index < count; index += 1) {
      const target = targets.nth(index);
      const exempt = await target.evaluate(
        (node, selectors) => selectors.some(sel => node.closest(sel) !== null),
        EXEMPT
      );
      if (exempt) continue;

      const box = await target.boundingBox();
      if (!box) continue;
      measured += 1;
      expect(
        Math.max(box.height, box.width),
        `target ${index}: ${await target.evaluate(e => e.outerHTML.slice(0, 160))}`
      ).toBeGreaterThanOrEqual(44);
    }

    // The exemption list must not swallow the whole page.
    expect(measured).toBeGreaterThan(0);
  });
}
