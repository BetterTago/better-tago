import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * The emergency and contact directories, on their own URLs.
 *
 * Both were `#emergency` / `#contact` sections of the home page and still are.
 * What these routes add is a destination a reader can be sent straight to, and
 * what the tests below defend is that adding it did not fork the data: the two
 * surfaces render the same component, so they must show the same numbers.
 */
const CONFIG = JSON.parse(
  readFileSync(path.join(process.cwd(), 'config', 'lgu.config.json'), 'utf8')
) as {
  lgu: { officialName: string };
  emergency: {
    nationalLine: string;
    municipalHotlines: { label: string; numbers: string[] }[];
  };
  contact: { municipalHall: { phone: string; email: string; address: string } };
};

test.describe('the emergency page', () => {
  test('carries the section’s own title as its h1', async ({ page }) => {
    await page.goto('/en/emergency');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'In an emergency'
    );
    // Exactly one. The directory's agency names are h3s under it, and a second
    // h1 would tell a screen-reader user this page is two documents.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('lists every obtained agency, and every number is dialable', async ({
    page,
  }) => {
    await page.goto('/en/emergency');
    const main = page.locator('main');

    for (const hotline of CONFIG.emergency.municipalHotlines) {
      await expect(main).toContainText(hotline.label);
    }

    const dialable = await main
      .locator('a[href^="tel:"]')
      .evaluateAll(links => links.map(link => link.getAttribute('href')));

    // The national line, plus every obtained municipal number. Normalised the
    // way `telHref` does it — a dialer gets the digits, the reader keeps the
    // spacing.
    expect(dialable).toContain(`tel:${CONFIG.emergency.nationalLine}`);
    for (const hotline of CONFIG.emergency.municipalHotlines) {
      for (const number of hotline.numbers) {
        expect(dialable).toContain(`tel:${number.replace(/[^\d]/g, '')}`);
      }
    }
  });

  test('🔴 states where the numbers came from ABOVE the numbers', async ({
    page,
  }) => {
    /*
     * A reader deciding whether to trust a number needs the citation BEFORE
     * they read one. The callout may never drift below the directory into a
     * footnote — on this page or on the home page.
     */
    await page.goto('/en/emergency');
    const main = page.locator('main');

    const source = main.getByRole('link', {
      name: /official Facebook page/i,
    });
    await expect(source).toBeVisible();

    const citation = await source.boundingBox();
    /*
     * `ul > li`, not `li`. The masthead's breadcrumb trail is an `<ol>` of
     * `<li>`s and it sits at the very top of `main`, so a bare `li` locator
     * measures a CRUMB and this assertion passes or fails on the position of
     * something that is not a number at all. The directory's agencies are the
     * only `ul` rows on the page.
     */
    const firstAgency = await main.locator('ul > li').first().boundingBox();
    expect(citation!.y).toBeLessThan(firstAgency!.y);
  });

  test('closes with the national line as a full-width call band', async ({
    page,
  }) => {
    // The one number that works from any phone anywhere, and the one target
    // somebody might be hunting for in a storm — so it is unmissable and
    // one-handed rather than a row in the list.
    await page.goto('/en/emergency');
    const band = page.locator(
      `main a[href="tel:${CONFIG.emergency.nationalLine}"]`
    );
    await expect(band).toBeVisible();
    const box = await band.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // `ul > li` for the same reason as above — the breadcrumb must not be able
    // to answer a question about where the agencies are.
    const lastAgency = await page.locator('main ul > li').last().boundingBox();
    expect(box!.y).toBeGreaterThan(lastAgency!.y);
  });
});

test.describe('the contact page', () => {
  test('carries the section’s own title as its h1, naming the municipality', async ({
    page,
  }) => {
    await page.goto('/en/contact');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText(CONFIG.lgu.officialName);
  });

  test('publishes the hall’s phone, email and address, all actionable', async ({
    page,
  }) => {
    await page.goto('/en/contact');
    const main = page.locator('main');

    await expect(main).toContainText(CONFIG.contact.municipalHall.phone);
    await expect(main).toContainText(CONFIG.contact.municipalHall.email);
    await expect(main).toContainText(CONFIG.contact.municipalHall.address);

    await expect(
      main.locator(
        `a[href="tel:${CONFIG.contact.municipalHall.phone.replace(/[^\d]/g, '')}"]`
      )
    ).toBeVisible();
    await expect(
      main.locator(`a[href="mailto:${CONFIG.contact.municipalHall.email}"]`)
    ).toBeVisible();
  });

  test('🔴 states where the details came from ABOVE them', async ({ page }) => {
    await page.goto('/en/contact');
    const main = page.locator('main');

    const provenance = main.getByText(
      /read from the municipality's official contact page/i
    );
    await expect(provenance).toBeVisible();

    const citation = await provenance.boundingBox();
    /*
     * Scoped to `#contact`, not to `main`.
     *
     * `ul > li` over the whole page used to be enough — the note it replaces
     * said the masthead's breadcrumb is an `<ol>`, so a bare `li` measured a
     * crumb rather than a card. That reasoning stopped holding on 2026-08-21
     * when the local-conditions panel was mounted above this section: its
     * outlook cells are a `ul > li` too, and being higher up the page they
     * became "the first card" and inverted the comparison.
     *
     * The section this test is about is the one that carries the citation, so
     * measuring inside it is what the assertion always meant. It also stops the
     * next component added above from silently redefining "first card" again.
     */
    const cardTop = await page.evaluate(() => {
      // The citation and the card list are SIBLINGS inside ContactDirectory, so
      // the first card is found from the citation's own parent rather than from
      // the page. That is what the assertion always meant, and it no longer
      // depends on nothing else on the page using a `ul > li`.
      const citationNode = [...document.querySelectorAll('main p')].find(node =>
        /read from the municipality's official contact page/i.test(
          node.textContent ?? ''
        )
      );
      const card = citationNode?.parentElement?.querySelector('ul > li');
      return card ? card.getBoundingClientRect().top : null;
    });

    expect(cardTop).not.toBeNull();
    expect(citation!.y).toBeLessThan(cardTop!);
  });
});

test.describe('the two surfaces cannot disagree', () => {
  /*
   * 🔴 The whole reason the directories are components rather than copies.
   * Two lists of emergency numbers is two lists that can drift, and the one
   * that is wrong will be the one nobody remembered to update.
   */
  test('the page and the home section dial the same numbers', async ({
    page,
  }) => {
    const dialableIn = async (url: string, scope: string) => {
      await page.goto(url);
      return (
        await page
          .locator(scope)
          .locator('a[href^="tel:"]')
          .evaluateAll(links => links.map(link => link.getAttribute('href')))
      ).sort();
    };

    expect(await dialableIn('/en/emergency', 'main')).toEqual(
      await dialableIn('/en', '#emergency')
    );
  });

  test('the page and the home section give the same contact routes', async ({
    page,
  }) => {
    /*
     * DESTINATIONS, deduplicated — not a count of anchors.
     *
     * The claim is that both surfaces offer the same ways to reach the
     * municipality, and a destination linked twice on one of them is not drift.
     * `/en/contact` gained a second link to the same map on 2026-08-21, when the
     * local-conditions panel was mounted above this section and captioned its
     * map with the hall's address and a directions link. Same href, same place,
     * one more anchor.
     *
     * ⚠️ Comparing sets rather than lists is deliberately weaker in exactly one
     * way, and it is worth knowing which: it would no longer notice a surface
     * that lost a DUPLICATE. It still fails the moment either surface gains or
     * loses a destination the other does not have, which is the drift this test
     * exists to catch.
     */
    const targetsIn = async (url: string, scope: string) => {
      await page.goto(url);
      const hrefs = await page
        .locator(scope)
        .locator('a[href^="tel:"], a[href^="mailto:"], a[href*="maps"]')
        .evaluateAll(links => links.map(link => link.getAttribute('href')));
      return [...new Set(hrefs)].sort();
    };

    expect(await targetsIn('/en/contact', 'main')).toEqual(
      await targetsIn('/en', '#contact')
    );
  });
});

test.describe('the menu reaches both, at either size', () => {
  /*
   * The header carries TWO menus and shows exactly one: the row is `hidden
   * lg:block` and the burger is `lg:hidden`. So a test about one of them has to
   * say which width it is testing — this suite runs under both a desktop and a
   * Pixel 7 project, and the row simply does not exist in the second. Setting
   * the viewport explicitly is what makes each test mean the same thing in
   * both, rather than silently passing in one and timing out in the other.
   */
  const DESKTOP = { width: 1280, height: 900 };

  test('the desktop row links the routes rather than home-page anchors', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/en/services');
    const nav = page.getByRole('navigation', { name: 'Main' });

    await nav.getByRole('link', { name: 'Emergency', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/emergency$/);

    await page.goto('/en/services');
    await nav.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/contact$/);
  });

  test('the mobile sheet reaches the same two destinations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/en/services');
    await page.getByRole('button', { name: /open the menu/i }).click();
    await page
      .locator('.mobile-nav-panel')
      .getByRole('link', { name: 'Emergency', exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/emergency$/);
  });

  test('keeps the reader in their own language', async ({ page }) => {
    // A routed nav entry has to carry the locale prefix; an anchor never did.
    await page.setViewportSize(DESKTOP);
    await page.goto('/fil/services');
    await page
      .getByRole('navigation', { name: 'Pangunahin' })
      .getByRole('link', { name: 'Emerhensiya', exact: true })
      .click();
    await expect(page).toHaveURL(/\/fil\/emergency$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Sa oras ng emerhensiya'
    );
  });
});

/*
 * 🔴 TAGO-106 criterion 3, second half. The numbers being tappable is asserted
 * above; this is the other thing that criterion asks for, and it is the half
 * that breaks silently.
 *
 * 320px matters here more than anywhere else on the portal. An emergency
 * number that needs a sideways scroll to read is a number a resident does not
 * finish reading, and the row is the widest thing this project renders: an
 * agency name and a stack of 11-digit numbers held apart by `justify-between`,
 * with `whitespace-nowrap` on the digits so they can never break mid-number.
 * That combination is exactly what overflows if the measure is ever loosened.
 */
test.describe('the narrowest phone still reads', () => {
  for (const route of ['/emergency', '/contact']) {
    test(`${route} has no horizontal scroll at 320px, in either locale`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      for (const locale of ['en', 'fil']) {
        await page.goto(`/${locale}${route}`);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        );
        expect(
          overflow,
          `${locale}${route} overflows at 320px`
        ).toBeLessThanOrEqual(0);
      }
    });
  }
});

test('both routes are in the sitemap, in both locales', async ({ request }) => {
  const body = await (await request.get('/sitemap.xml')).text();
  for (const locale of ['en', 'fil']) {
    expect(body).toContain(`/${locale}/emergency`);
    expect(body).toContain(`/${locale}/contact`);
  }
});
