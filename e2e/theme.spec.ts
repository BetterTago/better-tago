import { expect, test, type Page } from '@playwright/test';

/**
 * The theme switch, in the only place its real failure modes show up.
 *
 * A unit test can prove the script resolves the right theme. It cannot prove
 * the theme survives a navigation, that the attribute lands before the first
 * paint, or that the button a reader actually presses is wired to any of it.
 */

/** The storage key, restated here on purpose — see the note in the first test. */
const STORAGE_KEY = 'bettertago-theme';

test.describe('the theme toggle', () => {
  test('starts in the theme the operating system asks for', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/en');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Both, always. Kapwa's own dark variant is class-bound; ours is
    // attribute-bound, and one without the other is half a page in the wrong
    // theme — the half a screenshot of our own components never shows.
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);

    await context.close();
  });

  test('lets the reader override the operating system', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/en');

    await page.getByRole('button', { name: /light theme/i }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

    await context.close();
  });

  test('remembers the choice across a reload', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: /dark theme/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('remembers the choice across a locale switch', async ({ page }) => {
    // A client-side navigation does NOT re-run the init script, and the root
    // layout that owns <html> is not re-rendered either. If the attribute were
    // written from anywhere but the document element it would be lost here.
    await page.goto('/en');
    await page.getByRole('button', { name: /dark theme/i }).click();

    await page.getByRole('link', { name: 'Filipino' }).click();
    await expect(page).toHaveURL(/\/fil$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  });

  test('applies the stored theme before the first paint', async ({ page }) => {
    /*
     * The flash-of-wrong-theme test, and the reason the init script exists.
     *
     * `addInitScript` seeds storage before any document script runs, so this is
     * a genuine cold first load with a preference already set — exactly the
     * returning reader. The assertion is taken from the very first HTML the
     * page produces rather than after any hydration.
     *
     * The key is restated as a literal here deliberately: importing it from
     * `src/` would put the string in a second file, and a guardrail asserts
     * only one module in `src/` carries it. e2e/ is outside that scan, and a
     * hardcoded value here would be caught immediately by this test failing.
     */
    await page.addInitScript(key => {
      window.localStorage.setItem(key, 'dark');
    }, STORAGE_KEY);

    await page.goto('/en');
    const painted = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(painted).toBe('dark');
  });

  test('renders exactly one theme control, with one accessible name', async ({
    page,
  }) => {
    // Both icons and both names ship in the markup and CSS hides the wrong
    // pair. `display: none` is what keeps the hidden name out of the
    // accessibility tree — if it regressed to `sr-only` alone, the button
    // would announce both directions at once.
    await page.goto('/en');
    await expect(page.getByRole('button', { name: /dark theme/i })).toHaveCount(
      1
    );
    await expect(
      page.getByRole('button', { name: /light theme/i })
    ).toHaveCount(0);
  });

  test('announces the new state politely', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: /dark theme/i }).click();

    const live = page.locator('[aria-live="polite"]');
    await expect(live).toHaveText(/dark theme on/i);
  });

  test('labels and announces the control in Filipino too', async ({ page }) => {
    await page.goto('/fil');
    await page.getByRole('button', { name: /madilim na tema/i }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      /madilim na tema/i
    );
  });

  test('keeps working when localStorage throws, as in private browsing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Some private-browsing modes throw outright rather than returning false.
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => {
          throw new Error('access denied');
        },
      });
    });

    await page.goto('/en');
    await page.getByRole('button', { name: /dark theme/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('both themes are a gate, not a preference', () => {
  /**
   * How light the page ground actually renders, 0–1.
   *
   * Measured rather than compared against a literal. Pinning the two hex values
   * here would duplicate the palette in a file that has no other reason to know
   * it, and a legitimate re-point would then fail an end-to-end test in the last
   * place anyone would look for it. What this has to prove is that the theme
   * reaches the pixels — not which pixels.
   */
  async function groundLightness(page: Page) {
    return page.evaluate(() => {
      const [r, g, b] = getComputedStyle(document.body)
        .backgroundColor.match(/\d+(\.\d+)?/g)!
        .slice(0, 3)
        .map(channel => {
          const value = Number(channel) / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
  }

  for (const locale of ['en', 'fil']) {
    test(`the holding page renders in both themes, in ${locale}`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const light = await groundLightness(page);

      await page.getByRole('button', { name: /dark theme|madilim/i }).click();

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const dark = await groundLightness(page);

      // The theme reached the pixels. A theme that sets an attribute and no
      // colour is the failure `@theme inline` exists to prevent, and it is
      // invisible to every other assertion in this file. Halving is a floor far
      // below any real palette's gap, so a re-point cannot trip it.
      expect(dark).toBeLessThan(light / 2);
    });
  }

  test('never scrolls the body sideways at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/en');

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflows).toBe(false);
  });
});
