import { expect, test } from '@playwright/test';

/**
 * The gap register — every fact this project has looked for and not obtained.
 */
test.describe('the gap register', () => {
  test('lists every pending item with its reason', async ({ page }) => {
    await page.goto('/en/gaps');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Thirteen entries in the register today; the assertion is a floor, so
    // closing one does not fail the build while emptying it silently would.
    expect(await page.locator('li').count()).toBeGreaterThanOrEqual(10);
  });

  test('separates an unobtained gap from a held one', async ({ page }) => {
    /*
     * "We could not get it" and "we have it and are deliberately not publishing
     * it" are different absences and must not read as one. The postal code is
     * the held one: the official site publishes a value outside this province's
     * range, so printing it would propagate an error and correcting it would
     * invent one.
     */
    await page.goto('/en/gaps');
    await expect(page.getByText(/not obtained yet/i).first()).toBeVisible();
    await expect(
      page.getByText(/deliberately not published/i).first()
    ).toBeVisible();
    await expect(page.getByText('lgu.postalCode')).toBeVisible();
  });

  test('⚠️ no gap surface remains on the home page — the footer is the way in', async ({
    page,
  }) => {
    /*
     * 🔴 A real change of state, recorded rather than papered over.
     *
     * This used to assert that a gap surface on the home page linked the
     * register — "we do not know" turned into a request for help. On
     * 2026-08-10 the last two closed: the stat band filled all four figures,
     * and the emergency section published six agencies. So `main` now renders
     * NO gap surface and therefore no register link.
     *
     * The register itself still holds six open entries (households, PSGC,
     * district, postal code, office hours, the project's own address) —
     * coordinates left it on 2026-08-20 when TAGO-115 needed a query point. It is simply only reachable from the footer
     * now. `TAGO-114`'s criterion — every gap surface links the register — is
     * still met, but vacuously, and that is worth knowing rather than
     * discovering later.
     *
     * If a gap surface returns to the home page, this test should go back to
     * asserting the link rather than its absence.
     */
    await page.goto('/en');
    await expect(
      page
        .locator('main')
        .getByRole('link', { name: /see everything that is missing/i })
    ).toHaveCount(0);

    // Still reachable, and still one click away.
    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: /what is missing/i });
    await expect(footerLink).toBeVisible();
    await footerLink.click();
    await expect(page).toHaveURL(/\/en\/gaps$/);
  });

  test('is reachable from the footer', async ({ page }) => {
    await page.goto('/en');
    await page
      .locator('footer')
      .getByRole('link', { name: /what is missing/i })
      .click();
    await expect(page).toHaveURL(/\/en\/gaps$/);
  });

  test('tells a Filipino reader the reasons are recorded in English', async ({
    page,
  }) => {
    // The fallback is deliberate and is never silent anywhere else in this
    // portal; it is not silent here either.
    await page.goto('/fil/gaps');
    await expect(page.getByText(/hindi pa ito naisasalin/i)).toBeVisible();
  });
});
