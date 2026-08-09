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
  // partial reads as a complete one.
  await expect(
    page.getByText(/of \d+ services carry the charter/)
  ).toBeVisible();

  await expect(
    page.getByRole('link', { name: 'Civil registry', exact: true })
  ).toBeVisible();
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
  // the page no longer spends a section saying the charter does not.
  await expect(page.getByText('Who provides it:')).toBeVisible();
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

  // And the page says nobody has checked it, because nobody has.
  await expect(
    page.getByText(/not yet checked by a second person/)
  ).toBeVisible();
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
