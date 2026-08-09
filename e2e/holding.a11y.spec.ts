import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Axe catches roughly a third of real accessibility problems. It is the floor,
 * not the ceiling — tab through the page yourself before calling a route done.
 */
/*
 * Both themes and both locales, because both themes are a gate rather than a
 * preference — and because contrast is the failure mode a dark theme
 * introduces, which is precisely what axe is good at catching.
 *
 * The theme is set through the OS preference on a fresh context rather than by
 * clicking the toggle: that exercises the pre-paint script, which is the path a
 * real first visit takes.
 */
for (const colorScheme of ['light', 'dark'] as const) {
  for (const locale of ['en', 'fil']) {
    test(`@a11y the holding page has no axe violations in ${locale}, ${colorScheme}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme });
      const page = await context.newPage();
      await page.goto(`/${locale}`);
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

test('@a11y the first tab stop is the skip link, and it becomes visible', async ({
  page,
}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveText(/skip to content/i);
  // A skip link that stays invisible on focus is worse than none — a keyboard
  // user cannot tell it fired.
  await expect(focused).toBeInViewport();
});

test('@a11y every interactive target is at least 44px', async ({ page }) => {
  await page.goto('/en');

  /*
   * `:not(.sr-only)` is not an exemption — it is a measurement correction.
   *
   * The skip link is deliberately clipped to a 1px box until it takes focus,
   * which is the whole point of it. Measuring it unfocused reports 1×1 and says
   * nothing about whether a keyboard user can hit it; the test below measures
   * it in the state a user actually meets it in. Anything else that ends up
   * visually hidden AND interactive is a bug in its own right, so nothing else
   * belongs in this selector.
   */
  /*
   * Scoped to our own chrome, because `webServer` runs `next dev` and the dev
   * overlay injects a 32px "Open Next.js Dev Tools" button into the same
   * document. It mounts asynchronously, so an unscoped query fails this test
   * roughly half the time and passes the other half — a flake that looks like a
   * real accessibility regression and wastes the next person's afternoon.
   * Nothing under these three landmarks is Next's.
   */
  const targets = page
    .locator('header, main, footer')
    .locator('a:visible:not(.sr-only), button:visible:not(.sr-only)');
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const box = await target.boundingBox();
    if (!box) continue;
    // Inline links inside a paragraph are exempt (WCAG 2.5.8 inline exception);
    // this page has none, so every visible target is a real control.
    expect(
      Math.max(box.height, box.width),
      `target ${index}: ${await target.evaluate(e => e.outerHTML.slice(0, 160))}`
    ).toBeGreaterThanOrEqual(44);
  }
});

test('@a11y the skip link is a real target once it is focused', async ({
  page,
}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  const box = await page.locator(':focus').boundingBox();
  expect(box).not.toBeNull();
  expect(Math.max(box!.height, box!.width)).toBeGreaterThanOrEqual(44);
});
