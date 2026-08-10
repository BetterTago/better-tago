import { expect, test } from '@playwright/test';

/**
 * Search — a real GET form, server-rendered results, and no client-side
 * JavaScript anywhere in the mechanism.
 */
test.describe('search', () => {
  test('🔴 returns results with JavaScript disabled', async ({ browser }) => {
    /*
     * TAGO-110's load-bearing criterion. This is not a fallback path — it is
     * the only path. The form is an ordinary GET submission, the results are an
     * ordinary server-rendered document, and no search index is ever shipped to
     * the browser.
     */
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/en');
    await page.getByRole('searchbox').first().fill('business');
    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click();

    // ?q= became a path segment via the route handler, with no JS involved.
    await expect(page).toHaveURL(/\/en\/search\/business$/);
    await expect(
      page.locator('main').getByRole('heading', { level: 2 })
    ).toContainText(/business/i);
    expect(await page.locator('a[href*="/services/"]').count()).toBeGreaterThan(
      0
    );

    await context.close();
  });

  test('🔴 every popular chip returns real results', async ({ page }) => {
    /*
     * A chip that leads to an empty results page is worse than no chip: it
     * teaches a reader that the search does not work. These three are checked
     * against the manifests rather than chosen for how they read.
     */
    await page.goto('/en');
    const chips = page.locator('form[role="search"] ~ div a[href*="/search/"]');
    expect(await chips.count()).toBe(3);

    for (let index = 0; index < 3; index += 1) {
      const href = await chips.nth(index).getAttribute('href');
      await page.goto(href!);
      await expect(
        page.locator('main').getByRole('heading', { level: 2 })
      ).toContainText(/service/i);
      expect(
        await page.locator('a[href*="/services/"]').count()
      ).toBeGreaterThan(0);
      await page.goto('/en');
    }
  });

  test('gives the result a shareable URL', async ({ page }) => {
    await page.goto('/en/search/permit');
    await expect(
      page.locator('main').getByRole('heading', { level: 2 })
    ).toContainText(/permit/i);
  });

  test('searches title, description and category', async ({ page }) => {
    await page.goto('/en/search/health');
    expect(await page.locator('a[href*="/services/"]').count()).toBeGreaterThan(
      0
    );
  });

  test('narrows on two terms rather than widening', async ({ page }) => {
    // AND, not OR: a resident typing two words is narrowing. "business permit"
    // must not return every page containing "business".
    await page.goto('/en/search/business');
    const broad = await page.locator('a[href*="/services/"]').count();
    await page.goto('/en/search/business%20permit');
    const narrow = await page.locator('a[href*="/services/"]').count();
    expect(narrow).toBeLessThanOrEqual(broad);
  });

  test('🔴 an empty result explains what to try and links the official site', async ({
    page,
  }) => {
    /*
     * Never a bare empty state. On a portal that is still mostly gaps this is
     * the NORMAL case, so it is designed rather than defaulted.
     */
    await page.goto('/en/search/zzzzznotathing');
    await expect(page.getByText(/nothing here matches/i)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /browse every service/i })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /search the official municipal site/i })
    ).toHaveAttribute('href', 'https://tago.gov.ph');
  });

  test('refuses to be an open redirect', async ({ page }) => {
    /*
     * The locale rides along in a hidden field and reaches a redirect target,
     * so it is validated against the routing table rather than trusted. An
     * unvalidated one would send a reader off-site from a URL that looks like
     * this portal's own.
     */
    await page.goto('/api/search?q=permit&locale=https://evil.example');
    await expect(page).toHaveURL(/localhost.*\/en\/search\/permit$/);
  });

  test('sends an empty search back to the form, not to an empty result', async ({
    page,
  }) => {
    await page.goto('/api/search?q=&locale=en');
    await expect(page).toHaveURL(/\/en\/search$/);
  });

  test('refuses a malformed escape rather than 500ing', async ({ page }) => {
    /*
     * A crafted or truncated URL is the ordinary way `decodeURIComponent`
     * throws. What matters is that the reader gets a clean refusal rather than
     * a server error on a civic site — the exact code is the server's to pick
     * (Next rejects some malformed URLs before routing reaches the page, so it
     * is a 400 there and a 404 from `notFound()` otherwise).
     */
    const response = await page.goto('/en/search/%E0%A4%A');
    expect(response?.status()).toBeGreaterThanOrEqual(400);
    expect(response?.status()).toBeLessThan(500);
  });

  test('is not indexed', async ({ page }) => {
    await page.goto('/en/search/permit');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    );
  });
});
