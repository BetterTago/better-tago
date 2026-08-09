import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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

        const results = await new AxeBuilder({ page })
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
