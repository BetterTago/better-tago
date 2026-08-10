import { expect, test } from '@playwright/test';

/**
 * The service routes — the first surface this portal publishes that a resident
 * can actually act on.
 *
 * These check the things that make a transcription trustworthy rather than the
 * things that make a page render: that the charter's own numbering survives to
 * the browser, that a page states its source, that an unknown slug is a real
 * 404, and that a Filipino reader looking at English is told so.
 */

/** One service transcribed with the charter's contents, in both locales. */
const TRANSCRIBED = '/services/tourism/apply-for-dot-accreditation';

test('the index lists every category and says how much is transcribed', async ({
  page,
}) => {
  await page.goto('/en/services');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Services');

  // The count is the honesty. A partial transcription that does not say it is
  // partial reads as a complete one — and it sits in the masthead beside the
  // search field rather than below the fold.
  await expect(
    page.getByText(/\d+ of \d+ services fully transcribed/)
  ).toBeVisible();

  // The card's accessible name is its label, its count and its description —
  // which is what a screen-reader user needs in order to choose a category
  // without opening it. The three example services under it are `aria-hidden`,
  // so eleven cards do not read out thirty-three service titles.
  await expect(
    page.getByRole('link', { name: /^Civil registry/ }).first()
  ).toBeVisible();
});

test('every category card says what is in it without opening it', async ({
  page,
}) => {
  /*
   * The failure the official charter index has today: a title and nothing else,
   * so a resident has to open every category to find out whether their task is
   * in it. The card carries a description and three real service names.
   */
  await page.goto('/en/services');

  const card = page.getByRole('link', { name: /^Civil registry/ }).last();
  await expect(card).toContainText('Births, marriages, deaths');
  await expect(card).toContainText('Register a birth');
});

test('the wayfinding rail marks the category you are on, and does not link it', async ({
  page,
}) => {
  // A link to the page you are already on announces itself as operable and then
  // does nothing. TAGO-209 criterion 5.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/services/civil-registry');

  const rail = page.getByRole('navigation', { name: 'All categories' });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('link', { name: /^Health/ })).toBeVisible();

  const current = rail.locator('[aria-current="page"]');
  await expect(current).toHaveText(/Civil registry/);
  await expect(rail.getByRole('link', { name: /^Civil registry/ })).toHaveCount(
    0
  );
});

test('the breadcrumb walks back up, and the last crumb is not a link', async ({
  page,
}) => {
  await page.goto('/en/services/civil-registry/register-a-birth');

  const crumbs = page.getByRole('navigation', { name: 'You are here' });
  await expect(crumbs.getByRole('link', { name: 'Services' })).toBeVisible();
  await expect(
    crumbs.getByRole('link', { name: 'Civil registry' })
  ).toBeVisible();
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText(
    'Register a birth'
  );

  await crumbs.getByRole('link', { name: 'Civil registry' }).click();
  await expect(page).toHaveURL(/\/en\/services\/civil-registry$/);
});

test('🔴 the office filter is a shareable URL that works without JavaScript', async ({
  browser,
}) => {
  /*
   * TAGO-204's third and fourth criteria together. The filter is a route
   * SEGMENT rather than `?office=` precisely so this test can exist: a
   * `<Suspense>` boundary would stream the rows as a hidden div and return
   * nothing to a reader with scripting off.
   */
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/en/services/office/office-of-the-municipal-nutrition');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Office of the Municipal Nutrition'
  );

  const rows = page.locator('main a[href*="/services/"][href*="/"]');
  expect(await rows.count()).toBeGreaterThan(0);

  // It is a FILTER over tasks, not an office directory: every row still points
  // at a service page under its own category.
  await expect(
    page.locator('main a[href^="/en/services/health/"]').first()
  ).toBeVisible();

  await context.close();
});

test('a category with several offices offers them as filters; one with a single office does not', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // Health is provided by two offices.
  await page.goto('/en/services/health');
  const chips = page.getByRole('navigation', { name: 'Filter by office' });
  await expect(chips).toBeVisible();
  await expect(
    chips.getByRole('link', { name: /Office of the Municipal Nutrition/ })
  ).toBeVisible();

  // Civil registry is provided by one. A lone chip beside "All 14" filters
  // nothing, so none is rendered.
  await page.goto('/en/services/civil-registry');
  await expect(
    page.getByRole('navigation', { name: 'Filter by office' })
  ).toHaveCount(0);
});

test('🔴 an unknown office falls back to the unfiltered list, not to an error', async ({
  page,
}) => {
  /*
   * TAGO-204 criterion 5, and the one place this portal deliberately does NOT
   * 404. An office slug is a filter value, not a page: a stale link to a
   * renamed office should land a reader on every service rather than on an
   * error. An unknown CATEGORY still 404s — that names content that does not
   * exist — and the test below asserts both, together, so the difference cannot
   * be flattened by accident.
   */
  const response = await page.goto('/en/services/office/not-an-office');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/en\/services$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Services');

  const category = await page.goto('/en/services/not-a-category');
  expect(category?.status()).toBe(404);
});

test('a category page lists its services with the office that provides each', async ({
  page,
}) => {
  await page.goto('/en/services/civil-registry');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Civil registry'
  );
  await expect(
    page.getByRole('link', { name: 'Register a birth' })
  ).toBeVisible();
  await expect(
    page.getByText('Office of the Municipal Civil Registrar').first()
  ).toBeVisible();
});

test('a transcribed service states its requirements, its fee and its source', async ({
  page,
}) => {
  await page.goto(`/en${TRANSCRIBED}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Apply for DOT accreditation'
  );

  // The transcription, in the document's own structure — not re-sectioned into
  // headings this project chose.
  await expect(
    page.getByRole('heading', { name: 'What the charter says' })
  ).toBeVisible();
  await expect(
    page.getByText('Checklist of requirements').first()
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Letter of Request' })
  ).toBeVisible();

  // The office is named — which is what tells a resident where to go, and why
  // the page no longer spends a section saying the charter does not. Twice
  // over: in the masthead panel, and in the transcription's own opening line.
  await expect(page.getByText('Who provides it').first()).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Municipal Tourism Office' })
  ).toBeVisible();

  // 🔴 And no completeness block: that belongs to the transcript, not here.
  await expect(page.getByText(/Also printed for this service/)).toHaveCount(0);

  // Cite or don't publish. The document is NAMED by the title the municipality
  // files it under — "Tourism Office", not the filename — and the link to it
  // carries a fixed label. Asserted separately, so a change to either is a
  // change somebody sees.
  await expect(page.getByText('Tourism Office').first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open the official document' })
  ).toBeVisible();

  /*
   * ⚠️ The page no longer carries *"not yet checked by a second person"* — the
   * blockquote was removed on 2026-08-10 by instruction. What must stay true is
   * the opposite claim never appearing: the Verifier role is vacant and every
   * `verificationRecord` is null.
   */
  await expect(page.getByText(/verified by a second person/i)).toHaveCount(0);
});

test('🔴 the charter’s own list numbers survive to the browser', async ({
  page,
}) => {
  /*
   * Markdown renumbers an ordered list by default, and eleven of these charters
   * number lists that do not count up. This is the end-to-end proof that what
   * `charter-markdown.mjs` writes is what a resident reads.
   */
  await page.goto(
    '/en/services/civil-registry/add-missing-details-to-a-civil-registry-record'
  );

  /*
   * That charter prints 1, 2, 3, 4, 5, 7 — it skips 6. The transcription shows
   * them in the document's own checklist table, where a markdown renderer has
   * no list to renumber. This asserts the numbers a resident reads are the
   * numbers the office will read back to them.
   */
  const body = await page.locator('article').innerText();
  expect(body).toContain('7. PSA’s Request Form');
  expect(body).not.toContain('6. PSA’s Request Form');
});

test('a service links its full document transcript, in the same locale', async ({
  page,
}) => {
  await page.goto(`/fil${TRANSCRIBED}`);

  const link = page.getByRole('link', { name: /Basahin ang buong dokumento/ });
  await expect(link).toBeVisible();
  // Locale-prefixed, and to the Filipino twin — not into the English tree.
  await expect(link).toHaveAttribute(
    'href',
    '/fil/charter/documents/tourism-external-services'
  );

  await link.click();
  await expect(page).toHaveURL(/\/fil\/charter\/documents\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the transcript carries the internal services a task page never shows', async ({
  page,
}) => {
  // 68 of the archive's 167 services are government-to-government. The
  // transcript is the only place they exist, and it says plainly why.
  await page.goto('/en/charter/documents/office-of-the-vice-mayor');
  await expect(
    page.getByRole('heading', { name: /Internal services/ })
  ).toBeVisible();
  await expect(
    page.getByText(/between municipal offices — government to government/i)
  ).toBeVisible();
});

test('🔴 every service carries its transcription, not a note saying it cannot', async ({
  page,
}) => {
  /*
   * This service used to render *This page cannot tell you yet* while its
   * transcription sat complete in the record — because the page was being
   * re-sectioned into eight headings and its fields could not all be
   * re-derived. Thirty services were in that state. The page now shows the
   * transcription as transcribed, and the marriage-license requirements are one
   * of the longest and most useful lists in the archive.
   */
  await page.goto('/en/services/civil-registry/apply-for-a-marriage-license');

  await expect(page.getByText(/cannot tell you yet/)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'What the charter says' })
  ).toBeVisible();
  await expect(
    page.getByRole('cell', {
      name: /Certificate of No Marriage\/Marriage Advisory/,
    })
  ).toBeVisible();
});

test('an unknown slug is a real 404, not a soft 200', async ({ page }) => {
  const response = await page.goto('/en/services/civil-registry/not-a-service');
  expect(response?.status()).toBe(404);
});

test('an unknown category is a real 404', async ({ page }) => {
  const response = await page.goto('/en/services/not-a-category');
  expect(response?.status()).toBe(404);
});

test('the on-this-page rail lists the article’s own headings, and reaches them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/en${TRANSCRIBED}`);

  const rail = page.getByRole('navigation', { name: 'On this page' });
  const link = rail.getByRole('link', { name: 'What the charter says' });
  await expect(link).toBeVisible();

  // The anchor has to resolve to a heading that is actually on the page — the
  // failure a hardcoded rail would produce on a body whose sections differ.
  const href = await link.getAttribute('href');
  await expect(page.locator(`article ${href!}`)).toHaveText(
    'What the charter says'
  );
});

test('the on-this-page rail marks the section you are looking at', async ({
  page,
}) => {
  /*
   * Both ways of arriving at a section have to mark it: clicking a rail item,
   * and scrolling there without touching the rail. The state is carried by
   * `aria-current="location"` — `location` rather than `page`, because these
   * are sections within the current page — so a reader who cannot see the tint
   * gets it too.
   */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/en${TRANSCRIBED}`);

  const rail = page.getByRole('navigation', { name: 'On this page' });

  // At the top of the document, the first section is the one you are in.
  await expect(rail.locator('[aria-current="location"]')).toHaveText(
    'What the charter calls it'
  );

  // Clicked.
  await rail.getByRole('link', { name: 'The official document' }).click();
  await expect(rail.locator('[aria-current="location"]')).toHaveText(
    'The official document'
  );

  // Scrolled, without touching the rail — back to the top of the article.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(rail.locator('[aria-current="location"]')).toHaveText(
    'What the charter calls it'
  );

  // Exactly one at a time, always.
  await expect(rail.locator('[aria-current="location"]')).toHaveCount(1);
});

test('🔴 no page invents an opening time for a counter', async ({ page }) => {
  /*
   * The office panel deliberately shows no opening hours — removed on
   * 2026-08-10 by instruction as a question this surface does not answer.
   * `contact.municipalHall.officeHours` is still `null` with a `pending`
   * register entry, so the gap stays recorded where gaps are tracked.
   *
   * What this test guards is the half that must never change: a plausible
   * "8:00–17:00" appearing here would send somebody to a closed counter with
   * this portal's name on it. The panel is the one place that would be tempted
   * to fill it in, so the panel is where it is checked.
   */
  for (const route of [
    '/en/services/civil-registry',
    '/en/services/office/office-of-the-municipal-nutrition',
    '/en/services/civil-registry/register-a-birth',
  ]) {
    await page.goto(route);
    const panel = page.getByText('Purisima St.').first().locator('..');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/\d{1,2}:\d{2}/)).toHaveCount(0);
  }
});

test('the body never scrolls sideways at 320px, even with a table', async ({
  page,
}) => {
  /*
   * The requirements table is wider than a phone and always will be. It scrolls
   * inside its own container; the page does not. 320px is the narrowest device
   * this portal takes seriously.
   */
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/en${TRANSCRIBED}`);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('🔴 the sitemap carries every indexable page, and no search route', async ({
  request,
}) => {
  /*
   * This published ONE URL until 2026-08-10 — the home page, per locale, while
   * ~300 pages existed. A civic portal nobody can find is a civic portal that
   * does not work, so the count is asserted rather than eyeballed.
   *
   * Derived from the manifests, so adding a service adds a URL here with no
   * code change. The floor is deliberately loose: it fails if the generation
   * breaks, not every time a service is added.
   */
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();

  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  expect(urls.length).toBeGreaterThan(250);

  // Both locales, and the shapes that matter.
  for (const path of [
    '/en/services',
    '/fil/services',
    '/en/services/civil-registry',
    '/en/services/civil-registry/register-a-birth',
    '/en/services/office/office-of-the-municipal-civil-registrar',
    '/en/charter/documents/tourism-external-services',
    '/en/gaps',
  ]) {
    expect(
      urls.some(url => url.endsWith(path)),
      path
    ).toBe(true);
  }

  // 🔴 And NOT the search routes: every one of them is `noindex`, and listing a
  // page here that tells a crawler to stay away is a contradiction.
  expect(urls.filter(url => url.includes('/search'))).toEqual([]);
});
