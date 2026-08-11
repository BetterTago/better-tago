import { expect, test } from '@playwright/test';
// The configuration is the source of truth for every published number, so the
// assertions below are built from it rather than from literals that would
// silently drift the next time an agency is added or withdrawn.
import CONFIG from '../config/lgu.config.json';

/**
 * The home page — which replaced the holding page on 2026-08-10.
 *
 * The holding page's four statements were promoted into the independence
 * section rather than dropped, and the assertions that protected them are kept
 * here for the same reason: they are the sentences that stop this portal being
 * mistaken for the municipality's own.
 */
test.describe('the home page', () => {
  test('negotiates a locale from the bare root', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(en|fil)$/);
  });

  test('renders in English', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  /*
   * ⚠️ There is no above-the-fold independence assertion here any more.
   *
   * The section that carried it was removed by instruction on 2026-08-10, so
   * TAGO-110's fourth criterion is unmet and there is nothing to assert. The
   * test below still holds the footer statement, which renders on every page —
   * that is what remains of the claim, and it is below the fold.
   */

  test('carries the "built for" statement on every page', async ({ page }) => {
    /*
     * "not operated by, endorsed by, or affiliated with" was replaced on
     * 2026-08-10, by instruction, with BetterTandag's own footer pattern —
     * see SiteFooter.tsx and chrome.spec.ts's dedicated test for the fuller
     * reasoning. This one just confirms the line renders, on every page.
     */
    await page.goto('/en');
    await expect(page.getByText(/Built by Tagon-on for Tago/i)).toBeVisible();
  });

  test('the repository is reachable, and each button is a real 44px target', async ({
    page,
  }) => {
    /*
     * The dedicated "Report an error" button was dropped on 2026-08-10, when
     * the Contribute column was ported to BetterTandag's own four-component
     * shape (cost line, Volunteer, Contribute code, network mark). There is
     * no correction-specific button any more — both buttons below point at
     * the same repository, and that IS where an issue gets filed.
     *
     * `contact.project.correctionChannel` is unchanged in the configuration
     * (still the repository's issues URL) and still validated by the schema;
     * nothing renders it directly today.
     */
    await page.goto('/en');
    for (const name of [/volunteer with us/i, /contribute code with us/i]) {
      const button = page.getByRole('link', { name });
      await expect(button).toHaveAttribute(
        'href',
        'https://github.com/BetterTago/better-tago'
      );
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('the same two buttons render in Filipino too', async ({ page }) => {
    await page.goto('/fil');
    await expect(
      page.getByRole('link', { name: /sumama bilang boluntaryo/i })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /mag-ambag ng code/i })
    ).toBeVisible();
  });

  test('links to the official municipal site, not away from it', async ({
    page,
  }) => {
    // In the footer's Elsewhere column since the independence section was
    // removed. It is the authoritative record and it stays reachable from
    // every page.
    await page.goto('/en');
    const official = page
      .locator('footer')
      .getByRole('link', { name: /LGU Tago Website/i });
    await expect(official).toHaveAttribute('href', 'https://tago.gov.ph');
  });

  test('🔴 every dialable number on the page comes from the configuration', async ({
    page,
  }) => {
    /*
     * The single most important assertion in this file, and the rule it
     * defends did not change on 2026-08-10 when six agencies were published —
     * only the data did. No number may reach a resident that is not in the
     * configuration, with a source beside it. A hardcoded one in a component
     * is the failure this catches.
     *
     * Built from the config rather than a literal list, so publishing or
     * withdrawing an agency needs no edit here.
     */
    await page.goto('/en');

    const expected = new Set<string>([
      `tel:${CONFIG.emergency.nationalLine}`,
      ...CONFIG.emergency.municipalHotlines.flatMap(h =>
        h.numbers.map(n => `tel:${n.replace(/[^\d]/g, '')}`)
      ),
      // The municipal hall's own published landline — a contact detail, not a
      // hotline, and the one number outside the emergency surfaces.
      `tel:${CONFIG.contact.municipalHall.phone!.replace(/[^\d]/g, '')}`,
    ]);

    const all = await page
      .locator('a[href^="tel:"]')
      .evaluateAll(links => links.map(link => link.getAttribute('href')));

    expect(new Set(all)).toEqual(expected);
  });

  test('renders the six agencies, each citing the municipality’s own page', async ({
    page,
  }) => {
    /*
     * Until 2026-08-10 this asserted the OPPOSITE — that the section rendered
     * a stated absence, because four sweeps had found nothing. The numbers
     * were then found on the municipality's own Facebook page. The standard
     * did not move; a source turned up.
     */
    await page.goto('/en');
    const emergency = page.locator('#emergency');

    for (const hotline of CONFIG.emergency.municipalHotlines) {
      await expect(emergency).toContainText(hotline.label);
    }

    // The provenance sits ABOVE the numbers and links the source, so a reader
    // can check it rather than taking this page's word.
    const source = emergency.getByRole('link', {
      name: /official Facebook page/i,
    });
    await expect(source).toHaveAttribute(
      'href',
      CONFIG.socials.municipalFacebook!
    );
  });

  test('promotes the national line to a band at the BOTTOM of the section', async ({
    page,
  }) => {
    await page.goto('/en');
    const emergency = page.locator('#emergency');
    const band = emergency.locator('a[href="tel:911"]');
    await expect(band).toBeVisible();

    // Below the six agency rows, not above them.
    const bandBox = await band.boundingBox();
    const lastAgency = await emergency.locator('li').last().boundingBox();
    expect(bandBox!.y).toBeGreaterThan(lastAgency!.y);
  });

  test('the call band is on the gold ground, in the section’s own green', async ({
    page,
  }) => {
    /*
     * By instruction, 2026-08-10 — it was a deep green band on the emergency
     * section's deep green ground, which is the quietest thing the loudest
     * number could have been.
     *
     * Asserted through the SCOPE rather than through two computed colours: the
     * whole reason it carries `data-surface="accent"` is that the scope
     * re-points every ink role at once, so a class that later hardcodes one of
     * them is the regression worth catching. The contrast itself is measured
     * in theme-tokens.test.ts and enforced by the axe pass in home.a11y.spec.
     */
    await page.goto('/en');
    const band = page.locator('#emergency a[href="tel:911"]');
    await expect(band).toHaveAttribute('data-surface', 'accent');

    // The label and the number land on the same ink, which is what "the
    // section's own green" means once the scope has re-pointed `--ink-accent`.
    const [label, number] = await band
      .locator('span')
      .evaluateAll(nodes => nodes.map(n => getComputedStyle(n).color));
    expect(label).toBe(number);
  });

  test('the hero’s second CTA points at Contact, not at the hotline', async ({
    page,
  }) => {
    /*
     * It read "Emergency: 911" until 2026-08-10. The number did not go
     * anywhere — it is in the ticker on every page, in the header's Emergency
     * item, and in the call band this file already tests — so the hero's second
     * slot now points at the office that answers everything else.
     */
    await page.goto('/en');
    const hero = page.locator('main section').first();
    await expect(
      hero.getByRole('link', { name: 'Contact Us' })
    ).toHaveAttribute('href', '#contact');
    await expect(hero.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test('renders the four getting-here cards, above Get In Touch', async ({
    page,
  }) => {
    await page.goto('/en');
    const section = page.locator('#getting-here');
    await expect(section).toBeVisible();

    const cards = section.locator('article');
    await expect(cards).toHaveCount(4);
    for (const kicker of [
      'By air',
      'By land',
      'From Tandag',
      "Once you're here",
    ]) {
      await expect(section).toContainText(kicker);
    }

    // Above the contact section, by instruction.
    const here = await section.boundingBox();
    const contact = await page.locator('#contact').boundingBox();
    expect(here!.y).toBeLessThan(contact!.y);
  });

  test('🔴 the getting-here cards carry no timetable or fare', async ({
    page,
  }) => {
    /*
     * Orientation only. A departure time or a price would change without
     * notice, need its own citation, and outlive its accuracy on a page with
     * this file's slow cadence — so neither may appear. Enforced in
     * content-records.test.ts against the source too; this is the rendered
     * half.
     */
    await page.goto('/en');
    const text = (await page.locator('#getting-here').textContent()) ?? '';
    expect(text).not.toMatch(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i);
    expect(text).not.toMatch(/₱\s*\d/);
  });

  test('renders the services section from real, live routes', async ({
    page,
  }) => {
    await page.goto('/en');
    const services = page.locator('#services');
    await expect(services).toBeVisible();
    // Every category card is a real link into a route that exists.
    const cards = services.locator('a[href*="/services/"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(11);
  });

  test('renders the history timeline as an ordered list', async ({ page }) => {
    // A stack of divs tells a screen reader nothing about order or length, and
    // order is the entire content of a timeline. Six entries as of the
    // 2026-08-10 content rewrite — content/home/history/timeline.yaml is now
    // the source of truth for the count, not this test.
    await page.goto('/en');
    const timeline = page.locator('#history ol');
    await expect(timeline).toBeVisible();
    expect(await timeline.locator('> li').count()).toBe(6);
  });

  test('🔴 names the two historical office-holders the official page names', async ({
    page,
  }) => {
    /*
     * Both names are permitted ONLY because they come from content/, cited to
     * the municipality's own history page — root rule 13's carve-out for a
     * historical figure already in a cited public record. This asserts the
     * carve-out was actually used, not just documented.
     */
    await page.goto('/en');
    const timeline = page.locator('#history');
    await expect(timeline).toContainText('Francis Burton Harrison');
    await expect(timeline).toContainText('Catalino Pareja');
  });

  test('cites the official history page at the bottom of the section', async ({
    page,
  }) => {
    await page.goto('/en');
    const source = page.locator('#history').getByRole('link', {
      name: /official history page/i,
    });
    await expect(source).toHaveAttribute(
      'href',
      'https://tago.gov.ph/about-us-2/history/'
    );
  });

  test('links the municipal hall address to a verified Google Maps pin', async ({
    page,
  }) => {
    /*
     * Reversed on 2026-08-10, by instruction, from "text, never a map link" —
     * the earlier state existed because no pin had been confirmed. This one
     * was: the redirect resolves to a place literally named "Tago Municipal
     * Hall" at coordinates consistent with the municipality's own recorded
     * centroid, not a guess.
     */
    await page.goto('/en');
    const contact = page.locator('#contact');
    await expect(contact).toContainText(/Purisima St\., Tago, Surigao del Sur/);

    const pin = contact.getByRole('link', { name: /Purisima St/ });
    await expect(pin).toHaveAttribute(
      'href',
      'https://maps.app.goo.gl/fqEX9emT6ZZ9eVHr5'
    );
    await expect(pin).toContainText(/opens in Google Maps/i);
  });

  test('names the Office of the Mayor under the phone and email cards', async ({
    page,
  }) => {
    await page.goto('/en');
    const contact = page.locator('#contact');
    await expect(contact.getByText('086-214-2116')).toBeVisible();
    await expect(contact.getByText('lgutagosds@gmail.com')).toBeVisible();
    expect(await contact.getByText('Office of the Mayor').count()).toBe(2);
  });

  test('the phone and email cards are real, dialable links', async ({
    page,
  }) => {
    await page.goto('/en');
    const contact = page.locator('#contact');
    await expect(contact.locator('a[href="tel:0862142116"]')).toBeVisible();
    await expect(
      contact.locator('a[href="mailto:lgutagosds@gmail.com"]')
    ).toBeVisible();
  });

  test('does not render an office-hours gap notice in the contact section', async ({
    page,
  }) => {
    /*
     * `contact.municipalHall.officeHours` is still `null` and still listed on
     * /gaps — this only asserts the SECTION stopped rendering it, removed by
     * instruction on 2026-08-10.
     */
    await page.goto('/en');
    await expect(
      page.locator('#contact').getByText(/office hours/i)
    ).toHaveCount(0);
  });

  test('the provenance line runs full width, with no bordered box', async ({
    page,
  }) => {
    await page.goto('/en');
    const provenance = page
      .locator('#contact')
      .getByText(/read from the municipality's official contact page/i);
    await expect(provenance).toBeVisible();
    /*
     * `borderWidth`, not `borderStyle` — Tailwind's preflight resets every
     * element to `border-style: solid; border-width: 0`, so a bare element
     * with no border classes at all still computes `borderStyle: 'solid'`.
     * Zero width is what actually means "no visible border box".
     */
    expect(
      await provenance.evaluate(node => getComputedStyle(node).borderWidth)
    ).toBe('0px');
  });

  test('switches to Filipino and swaps the copy', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('link', { name: 'Filipino' }).first().click();
    await expect(page).toHaveURL(/\/fil$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
    // The hero's own heading is Surigaonon and identical in both catalogues,
    // so the copy swap is asserted on the lede beneath it.
    await expect(
      page.getByText(/mga serbisyo, impormasyon, at rekurso ng pamahalaan/i)
    ).toBeVisible();
  });

  test('404s a URL that does not exist', async ({ page }) => {
    const response = await page.goto('/en/no-such-page');
    expect(response?.status()).toBe(404);
  });

  test('has no horizontal scroll at 320px, in either locale', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const locale of ['en', 'fil']) {
      await page.goto(`/${locale}`);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow, `${locale} overflows at 320px`).toBeLessThanOrEqual(0);
    }
  });
});
