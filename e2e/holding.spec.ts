import { expect, test } from '@playwright/test';

test.describe('the holding page', () => {
  test('negotiates a locale from the bare root', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(en|fil)$/);
  });

  test('renders in English', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('says plainly that nothing has been published yet', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByText(/nothing has been published/i)).toBeVisible();
  });

  test('states its independence on every page', async ({ page }) => {
    await page.goto('/en');
    await expect(
      page.getByText(/not operated by, endorsed by, or affiliated with/i)
    ).toBeVisible();
  });

  test('carries a correction channel a resident can actually reach', async ({
    page,
  }) => {
    // The commitment is "tell us and we fix it first". A commitment with no
    // visible way to act on it is decoration, so this asserts the affordance
    // exists, points at the real tracker, and is a genuine 44px target.
    await page.goto('/en');
    const corrections = page.getByRole('link', { name: /report an error/i });
    await expect(corrections).toHaveAttribute(
      'href',
      'https://github.com/BetterTago/better-tago/issues'
    );
    await expect(corrections).toHaveAttribute('rel', /noopener/);
    expect((await corrections.boundingBox())?.height).toBeGreaterThanOrEqual(
      44
    );
  });

  test('carries the correction channel in Filipino too', async ({ page }) => {
    await page.goto('/fil');
    await expect(
      page.getByRole('link', { name: /mag-ulat ng mali/i })
    ).toBeVisible();
  });

  test('links to the official municipal site, not away from it', async ({
    page,
  }) => {
    await page.goto('/en');
    const official = page.getByRole('link', {
      name: /official municipal site/i,
    });
    await expect(official).toHaveAttribute('href', 'https://tago.gov.ph');
    await expect(official).toHaveAttribute('rel', /noopener/);
  });

  test('publishes no municipal emergency number it cannot cite', async ({
    page,
  }) => {
    await page.goto('/en');
    // The national line is the only number on the page. Anything else would
    // mean a hotline got published without a source.
    const telLinks = page.locator('a[href^="tel:"]');
    await expect(telLinks).toHaveCount(1);
    await expect(telLinks.first()).toHaveAttribute('href', 'tel:911');
  });

  test('switches to Filipino and swaps the copy', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('link', { name: 'Filipino' }).click();
    await expect(page).toHaveURL(/\/fil$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
    await expect(page.getByText(/Wala pang inilalathala rito/i)).toBeVisible();
  });

  test('404s a URL that does not exist', async ({ page }) => {
    const response = await page.goto('/en/no-such-page');
    expect(response?.status()).toBe(404);
  });
});
