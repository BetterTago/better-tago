import { expect, test, type Page } from '@playwright/test';

/**
 * Whichever heading the results section is announcing itself by — `#results-heading`
 * when there are hits, `#no-results` when there are none — on the page the reader
 * is actually LOOKING at.
 *
 * 🔴 `:visible` is load-bearing, not tidiness. After a client-side navigation
 * Next keeps the previous segment mounted inside `<main>` under
 * `display: none !important`, so a bare `#results-heading` matches TWICE — the
 * page on screen and the page behind it — and an id-based assertion fails
 * Playwright's strict mode with two counts of the same query
 * (`4 services for “business permit”` over `6 services for …`).
 *
 * `getByRole` never had this problem, because a `display: none` subtree is not
 * in the accessibility tree. Only the CSS locators need saying.
 */
const resultsHeading = (page: Page) =>
  page.locator('#results-heading:visible, #no-results:visible');

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

  test('🔴 a prerendered popular query renders the space, not %20', async ({
    page,
  }) => {
    /*
     * The bug this test is named for, exactly as it shipped.
     *
     * `generateStaticParams` pre-encoded its values. Next encodes a returned
     * param itself, so the URL was unchanged and the PARAM recorded against it
     * was escaped twice — and this route is partially prerendered, so the shell
     * renders at build time and the results resume at request time from that
     * recorded param. One document, two spellings: a tab reading
     * `Results for “business permit”` over a page reading
     * `Nothing here matches “business%20permit”`, with the six real results
     * missing.
     *
     * Checking the two AGREE is what makes this test the bug rather than a
     * paraphrase of it. A regression that broke both halves equally would slip
     * past an assertion on either one alone.
     */
    for (const query of ['business permit', 'birth certificate']) {
      await page.goto(`/en/search/${encodeURIComponent(query)}`);

      await expect(page).toHaveTitle(`BetterTago | Results for “${query}”`);
      const heading = resultsHeading(page);
      await expect(heading).toContainText(`“${query}”`);
      await expect(heading).not.toContainText('%');
      // The field a reader corrects their search in has to agree as well.
      await expect(page.getByRole('searchbox').first()).toHaveValue(query);
      // And these are the queries the chips promise results for.
      expect(
        await page.locator('main a[href*="/services/"]').count()
      ).toBeGreaterThan(0);
    }
  });

  test('🔴 a symbol the fold used to eat finds nothing, not six unrelated services', async ({
    page,
  }) => {
    /*
     * The defect, end to end, and the half a heading assertion cannot see.
     *
     * `fold` stripped `\p{Diacritic}`, which covers standalone punctuation and
     * not just the combining marks NFD produces: `^`, `` ` ``, `¨`, `¯`, `´` and
     * `¸` are all `Diacritic=Yes`. A search for `a^b` was therefore run as `ab`
     * and matched six services across agriculture, health, social welfare and
     * tourism — under a heading quoting `a^b` back at the reader, which is what
     * made them read as answers rather than as noise.
     *
     * Wrong results are worse than none on a civic portal, so this asserts the
     * RESULT SET and not the heading. Every earlier test in this file passed
     * throughout the bug, because the heading was never the part that was wrong.
     */
    for (const character of ['^', '`', '¨', '¯', '´', '¸']) {
      const query = `a${character}b`;
      await page.goto(`/api/search?q=${encodeURIComponent(query)}&locale=en`);

      // Nothing in the charter contains it, so nothing is the right answer.
      await expect(page.locator('#no-results'), query).toContainText(
        `“${query}”`
      );
      expect(
        await page.locator('main a[href*="/services/"]').count(),
        query
      ).toBe(0);
    }
  });

  test('🔴 no symbol comes back escaped, whatever it was', async ({ page }) => {
    /*
     * The sweep, rather than the one character somebody reported. Each of these
     * makes the real trip a typed query makes — `/api/search` drops `%` and
     * trims, redirects to an encoded segment, and the page reads it back — and
     * the heading has to quote what was typed, not the URL it travelled in.
     *
     * A `%` in a heading is the tell for every bug in this class, so it is
     * asserted separately from the exact text: it fails the same way whichever
     * escape leaked.
     */
    const cases: [typed: string, searched: string][] = [
      ['business permit', 'business permit'],
      ['a b  c', 'a b  c'], // repeated spaces, %20%20
      ['  spaced  ', 'spaced'], // trimmed by the handler
      ['100%', '100'], // `%` dropped — it cannot survive a path segment
      ['50%off', '50off'],
      ['a/b', 'a/b'], // %2F — would otherwise redirect somewhere else
      ['a?b', 'a?b'],
      ['a#b', 'a#b'],
      ['a&b', 'a&b'],
      ['a+b', 'a+b'],
      ['a=b', 'a=b'],
      ['a:b', 'a:b'],
      ['a;b', 'a;b'],
      ['a,b', 'a,b'],
      ['a@b', 'a@b'],
      ['a$b', 'a$b'],
      ['a"b', 'a"b'],
      ["a'b", "a'b"],
      ['a\\b', 'a\\b'],
      ['a|b', 'a|b'],
      ['a^b', 'a^b'], // Diacritic=Yes — was silently deleted, see search.ts
      ['a`b', 'a`b'],
      ['a´b', 'a´b'],
      ['a[b]', 'a[b]'],
      ['a{b}', 'a{b}'],
      ['a(b)', 'a(b)'],
      ['a<b>', 'a<b>'],
      ['señor', 'señor'],
      ['Bañaybañay', 'Bañaybañay'],
      ['日本', '日本'],
      ['👍', '👍'],
      ['../../etc/passwd', '../../etc/passwd'],
      ['<script>alert(1)</script>', '<script>alert(1)</script>'],
    ];

    for (const [typed, searched] of cases) {
      const response = await page.goto(
        `/api/search?q=${encodeURIComponent(typed)}&locale=en`
      );
      expect(response?.status(), typed).toBe(200);

      const heading = resultsHeading(page);
      await expect(heading, typed).toContainText(`“${searched}”`);
      if (!searched.includes('%')) {
        await expect(heading, typed).not.toContainText('%');
      }
      // The field is repopulated from the same value, so a reader correcting a
      // search never has to retype it — and never sees an escape either.
      await expect(page.getByRole('searchbox').first(), typed).toHaveValue(
        searched
      );
    }
  });

  test('🔴 a doubly-escaped URL resolves to the query, not to the escape', async ({
    page,
  }) => {
    /*
     * Belt to the braces above. The route must not depend on Next handing a
     * param over at one particular encoding depth — that assumption is what
     * shipped `%20`, and a Next upgrade or a platform routing layer can change
     * it again. `decodeParam` decodes until the string settles, so all three
     * spellings of one query are one page.
     */
    for (const segment of [
      'business permit',
      'business%20permit',
      'business%2520permit',
    ]) {
      await page.goto(`/en/search/${segment}`);
      const heading = resultsHeading(page);
      await expect(heading, segment).toContainText('“business permit”');
      expect(
        await page.locator('main a[href*="/services/"]').count(),
        segment
      ).toBeGreaterThan(0);
    }
  });

  test('a facet link keeps the query encoded exactly once', async ({
    page,
  }) => {
    /*
     * The rail builds its hrefs from the decoded query, and the filtered route
     * hands an unknown category back to the unfiltered one. Both are places a
     * segment gets rebuilt, and both are places a second round of escaping used
     * to be able to creep in.
     *
     * This one runs WITH JavaScript, unlike the facet test above it: the click
     * is a soft navigation, so the href is rebuilt by the client router rather
     * than by the browser, and that is a third place the escaping can slip.
     */
    await page.goto('/en/search/business%20permit');
    const facet = page
      .getByRole('navigation', { name: /narrow by category/i })
      .getByRole('link')
      .first();
    await facet.click();
    await expect(page).toHaveURL(/\/en\/search\/business%20permit\/[a-z-]+$/);
    await expect(resultsHeading(page)).toContainText('“business permit”');

    // And the fall-back redirect off an unknown category, which rebuilds it.
    await page.goto('/en/search/business%20permit/not-a-category');
    await expect(page).toHaveURL(/\/en\/search\/business%20permit$/);
    await expect(resultsHeading(page)).toContainText('“business permit”');
  });

  test('is not indexed', async ({ page }) => {
    await page.goto('/en/search/permit');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    );
  });
});
