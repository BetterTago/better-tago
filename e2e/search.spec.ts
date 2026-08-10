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

  test('🔴 refuses a malformed escape rather than 500ing', async ({ page }) => {
    /*
     * ⚠️ This failed in CI and passed locally for a while, and the reason is
     * worth keeping: CI runs a PRODUCTION build, and the dev server rejects
     * some of these earlier. A 500 on a civic site for a URL a chat client cut
     * in half is not acceptable in either.
     *
     * The fix is in `proxy.ts`, not here. Next decodes a dynamic route param
     * itself — repeatedly — before any code in the route runs, and throws a
     * `URIError` it does not catch. A `try/catch` inside the page cannot see it.
     *
     * Every one of these reached `failed to decode param` and a bare 500.
     */
    for (const url of [
      '/en/search/%E0%A4%A', // truncated escape
      '/en/search/100%25', // decodes to `100%`, which Next decodes again
      '/en/search/a%25b',
      '/en/search/certificate/%E0%A4%A', // and the category-filtered route
      '/en/services/%E0%A4%A', // and every other dynamic param in the app
      '/en/services/civil-registry/100%25',
    ]) {
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(400);
    }
  });

  test('🔴 a search containing a percent sign works, rather than 500ing', async ({
    browser,
  }) => {
    /*
     * The resident-facing half of the same defect, and the one that mattered:
     * "100%" is a query somebody can genuinely type. The form encoded it to
     * `/en/search/100%25`, Next decoded that to `100%`, decoded it again, and
     * threw — an Internal Server Error from the search box.
     *
     * There is no encoding that survives, because every one of them decodes
     * back to a lone `%`. The handler drops it, and the results page prints the
     * query it actually ran so nothing about that is hidden from the reader.
     */
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/en');
    await page.getByRole('searchbox').first().fill('100%');
    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/en\/search\/100$/);
    await expect(page).toHaveTitle('BetterTago | Results for “100”');
    // And the field shows what was searched, so the reader can correct it.
    await expect(page.getByRole('searchbox').first()).toHaveValue('100');

    await context.close();
  });

  test('the search field sits in the masthead, above the results', async ({
    page,
  }) => {
    // Where the design puts it, and where a reader who has just searched is
    // already looking. It was in the left rail beside the results first, which
    // is where you put a filter, not where you put the thing being refined.
    await page.goto('/en/search/certificate');

    const field = page.getByRole('searchbox');
    const heading = page.getByRole('heading', { level: 1 });
    const firstResult = page.locator('main a[href*="/services/"]').first();

    const [fieldBox, headingBox, resultBox] = await Promise.all([
      field.boundingBox(),
      heading.boundingBox(),
      firstResult.boundingBox(),
    ]);

    expect(fieldBox!.y).toBeGreaterThan(headingBox!.y);
    expect(fieldBox!.y).toBeLessThan(resultBox!.y);
  });

  test('🔴 a category facet narrows the results, and says which one is current', async ({
    browser,
  }) => {
    /*
     * The facets used to be counts you could read and not act on. They are
     * links now, to a route segment rather than a query parameter — same
     * reasoning as the office filter, and it is what lets this run with
     * JavaScript off.
     */
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/en/search/certificate');
    const before = await page.locator('main a[href*="/services/"]').count();

    const facet = page
      .getByRole('navigation', { name: /narrow by category/i })
      .getByRole('link', { name: /^Civil registry/ });
    await facet.click();

    await expect(page).toHaveURL(/\/en\/search\/certificate\/civil-registry$/);
    const after = await page.locator('main a[href*="/services/"]').count();
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);

    // The one you are on is not a link, and it says so to a screen reader.
    const rail = page.getByRole('navigation', { name: /narrow by category/i });
    await expect(rail.locator('[aria-current="true"]')).toHaveText(
      /Civil registry/
    );
    await expect(
      rail.getByRole('link', { name: /^Civil registry/ })
    ).toHaveCount(0);

    // And "All results" goes back, still counting the whole set.
    await rail.getByRole('link', { name: /^All results/ }).click();
    await expect(page).toHaveURL(/\/en\/search\/certificate$/);

    await context.close();
  });

  test('an unknown category on a search falls back to the whole result set', async ({
    page,
  }) => {
    const response = await page.goto('/en/search/certificate/not-a-category');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/en\/search\/certificate$/);
  });

  test('is not indexed', async ({ page }) => {
    await page.goto('/en/search/permit');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    );
  });
});
