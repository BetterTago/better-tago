import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { settleAnimations } from './settle';

/**
 * `TAGO-115` and `TAGO-116`, end to end.
 *
 * ## ⚠️ What this file deliberately does NOT test, and why
 *
 * **The weather loader's failure modes are not testable from here.** They were
 * written as Playwright tests first — aborting the upstream with `page.route()`
 * — and that silently did not work: the fetch runs on the SERVER and Playwright
 * intercepts only the BROWSER, so those tests were quietly exercising the real
 * Open-Meteo and passing or failing on whether it happened to be up. Precisely
 * the CI flake the design exists to avoid, introduced by the test meant to
 * prevent it.
 *
 * Those assertions moved to `src/lib/weather.test.ts`, against `fetchWeather`,
 * where the code actually runs and the network can actually be stubbed.
 *
 * **What is left here is what a browser can honestly observe**: that the page
 * renders, that the strip is in one of its two legitimate states whichever way
 * the network went, that it is nowhere near the emergency layer, and that the
 * counter shows nothing when there is no store — which is the state CI runs in.
 */

/** Either a real reading or the stated-unavailable line. Never neither. */
const READING_OR_STATED =
  /°C|a current weather reading is not available right now|walang makuhang/i;

const PANEL_HEADING = /finding tago, and the weather there|paghahanap sa tago/i;

test.describe('the conditions strip', () => {
  test('leaves the page completely ordinary, whichever way the upstream went', async ({
    page,
  }) => {
    await page.goto('/en');
    await settleAnimations(page);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    // `error.tsx` renders this. Reaching it means the page crashed.
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test('is in one of its two legitimate states, never a blank box', async ({
    page,
  }) => {
    /*
     * The invariant that holds regardless of the network: the strip either
     * shows a reading or says plainly that it has none. What it must never do
     * is render an empty container, a dash, or a zero.
     */
    await page.goto('/en');
    await settleAnimations(page);

    await expect(
      page.getByRole('heading', { name: PANEL_HEADING })
    ).toHaveCount(1);
    await expect(page.locator('main')).toContainText(READING_OR_STATED);
  });

  test('🔴 puts the MAP first and the weather second', async ({ page }) => {
    /*
     * The ordering is a decision, not a layout: a resident opening this section
     * is far more often asking *where is the municipal hall* than *what is the
     * temperature*. Asserted in DOM order so a later restyle that flips the two
     * columns has to argue with a test.
     */
    await page.goto('/en');
    await settleAnimations(page);

    const order = await page.evaluate(() => {
      const section = document.querySelector('#local-conditions');
      if (!section) return null;
      const map = section.querySelector(
        '[role="region"][aria-label*="Map of"]'
      );
      const address = section.querySelector('a[href*="maps.app.goo.gl"]');
      if (!map || !address) return null;
      // 4 === DOCUMENT_POSITION_FOLLOWING
      return {
        addressAfterMap: !!(
          map.compareDocumentPosition(address) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
      };
    });
    expect(order).not.toBeNull();
    expect(order?.addressAfterMap).toBe(true);
  });

  test('🔴 keeps the address and directions OUTSIDE the map container', async ({
    page,
  }) => {
    /*
     * This is what a reader with JavaScript off is left with, and it is the
     * whole reason the panel is built this way. If the address ever moves
     * inside the Leaflet container it disappears for exactly the readers this
     * portal is built for.
     */
    await page.goto('/en');
    await settleAnimations(page);

    const mapContainer = page.locator('[role="region"][aria-label*="Map of"]');
    await expect(mapContainer).toHaveCount(1);
    await expect(
      mapContainer.locator('a[href*="maps.app.goo.gl"]')
    ).toHaveCount(0);
    await expect(
      page.locator('#local-conditions').getByText(/Purisima St/)
    ).toBeVisible();
  });

  test('🔴 tells the reader the map contacts OpenStreetMap', async ({
    page,
  }) => {
    // The portal makes no other third-party request. Starting to make one
    // silently is the thing this assertion exists to prevent.
    await page.goto('/en');
    await settleAnimations(page);
    await expect(
      page.getByText(/loads its tiles from OpenStreetMap/i)
    ).toBeVisible();
    await expect(page.getByText(/ODbL/)).toBeVisible();
  });

  test('🔴 is inside main, not in the emergency layer above the header', async ({
    page,
  }) => {
    /*
     * `TAGO-115`'s first and strongest editorial rule, asserted structurally
     * rather than trusted to a reviewer. The hotline bar and the advisory bar
     * live ABOVE the header and carry this portal's emergency meaning; a
     * forecast strip placed in or beside that stack inherits it whatever the
     * caption says.
     *
     * If someone later "improves" this by hoisting it into the locale layout,
     * this is the test that stops them — and it would also put the strip on
     * ~380 routes, each of which would then depend on an upstream.
     */
    await page.goto('/en');
    await settleAnimations(page);

    await expect(
      page.locator('main').getByRole('heading', { name: PANEL_HEADING })
    ).toHaveCount(1);

    // And not anywhere outside it.
    await expect(
      page.getByRole('heading', { name: PANEL_HEADING })
    ).toHaveCount(1);
  });

  test('carries its attribution and its deference line whenever it has a reading', async ({
    page,
  }) => {
    await page.goto('/en');
    await settleAnimations(page);

    const main = page.locator('main');
    const hasReading = await main.getByText(/°C/).count();
    test.skip(
      hasReading === 0,
      'No reading in this environment — the unavailable branch is asserted above.'
    );

    // CC BY 4.0 requires both, and neither may sit behind a disclosure.
    await expect(main.getByRole('link', { name: 'Open-Meteo' })).toBeVisible();
    await expect(main.getByText(/CC BY 4\.0/)).toBeVisible();
    await expect(main.getByText(/PAGASA is the authority/i)).toBeVisible();

    /*
     * The reading's time sits ON the card — "Overcast at 10:45 PM" — rather than
     * in the footnote below. It moved there on 2026-08-20 so the timestamp
     * qualifies the figure it belongs to; carrying it in both places read as two
     * different times for one reading.
     */
    await expect(main.getByText(/ at \d{1,2}:\d{2}\s?(AM|PM)/i)).toBeVisible();
  });

  test('🔴 shows three outlook hours, all in the future', async ({ page }) => {
    /*
     * Three cells, and the count is load-bearing rather than cosmetic: the
     * upstream returns `hourly` from midnight of the first day only, so asking
     * for one day left a 22:30 reading with a single future hour and a 23:30
     * reading with none. The card quietly emptied out every evening. Two
     * forecast days is what keeps three hours available at any time of night.
     */
    await page.goto('/en');
    await settleAnimations(page);

    const panel = page.locator('#local-conditions');
    const hasReading = await panel.getByText(/°C/).count();
    test.skip(hasReading === 0, 'No reading in this environment.');

    await expect(panel.locator('ul > li')).toHaveCount(3);
  });

  test('renders in Filipino without falling back to English', async ({
    page,
  }) => {
    await page.goto('/fil');
    await settleAnimations(page);

    await expect(page.locator('main')).toContainText(
      /°C|walang makuhang kasalukuyang pagbasa/i
    );
  });

  test('@a11y has no axe violations with the strip on the page', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'One engine is enough for a rule-based scan.'
    );

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en');
      await settleAnimations(page);

      /*
       * `.hotline-viewport` is excluded, matching `home.a11y.spec.ts` and for
       * the reason documented there at length: axe resolves a background by
       * hit-testing an element's centre, and the bar is a horizontal scroller
       * whose content is wider than a phone, so its off-screen text hit-tests
       * against the PAGE and is reported at 1.35:1 against a colour it never
       * sits on. It is a limitation of measuring a scroll container.
       *
       * It is carried here rather than re-derived because this spec loads the
       * SAME page, so leaving it off would fail on a pre-existing surface this
       * change never touched. `theme-tokens.test.ts` computes those pairs
       * against their real ground and is the stronger check.
       *
       * The conditions strip itself is analysed in full — it is not in the
       * excluded subtree, and the test above asserts exactly that.
       */
      const results = await new AxeBuilder({ page })
        .exclude('.hotline-viewport')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations, colorScheme).toEqual([]);
    }
  });
});

test.describe('the visitor counter', () => {
  test('answers 204 and never errors, whatever the request', async ({
    request,
  }) => {
    /*
     * Success, refusal and a dead store are deliberately indistinguishable, so
     * an inflater learns nothing from the response. This request carries no
     * `sec-fetch-site` header, so it is on the refusal path — and must still be
     * a clean 204 rather than a 4xx that tells it why.
     */
    const response = await request.post('/api/visits');
    expect(response.status()).toBe(204);
  });

  test('🔴 never renders a zero, in either configuration', async ({ page }) => {
    /*
     * The invariant that holds whether or not a store — or a local preview
     * value — is configured, which is what makes it worth asserting here.
     *
     * With nothing configured the badge reads "— visits"; with a figure it
     * reads "12,480 visits". **What must never appear is `0`**: a zero is a
     * number, and this portal has not counted it. A dash is not a claim; a zero
     * is. The cold-store and malformed-value paths are pinned precisely in
     * `src/lib/visits.test.ts`, where the environment can actually be stubbed.
     */
    await page.goto('/en');
    await settleAnimations(page);

    const value = page.locator(
      'footer [data-badge="visits"] [data-badge-value]'
    );
    await expect(value).toHaveCount(1);

    // The VISIBLE figure only — the badge also carries two `sr-only` spans, and
    // reading the whole element picks those up.
    const text = (await value.textContent())?.trim() ?? '';
    expect(text).toMatch(/visits/i);
    expect(text).not.toMatch(/(^|\s)0\s/);
    expect(text).not.toMatch(/-\d/);
  });

  test('shows three badges in the footer rail, one of them the source link', async ({
    page,
  }) => {
    await page.goto('/en');
    await settleAnimations(page);

    const footer = page.locator('footer');
    // `[data-badge]`, not `.rounded-full` — the footer's cost line is a pill too.
    await expect(footer.locator('[data-badge]')).toHaveCount(3);
    /*
     * The source badge is the only one that is a LINK rather than a figure, and
     * the only one carrying its own colour. It keeps its external-site warning
     * for a screen reader — a pill is still a link out.
     */
    const source = footer.locator('[data-badge="source"]');
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(source).toHaveAttribute('rel', /noopener/);
    // The version badge carries the version from package.json, never a literal.
    await expect(footer.locator('[data-badge="version"]')).toHaveText(
      /\d+\.\d+\.\d+/
    );
  });

  test('a dead count endpoint does not disturb the page', async ({ page }) => {
    // This one CAN be intercepted: the POST is made by the browser.
    await page.route('**/api/visits', route => route.abort('failed'));

    await page.goto('/en');
    await settleAnimations(page);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });
});
