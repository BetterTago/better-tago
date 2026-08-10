import { expect, test } from '@playwright/test';

/**
 * The portal chrome every route inherits: the hotline bar, the header
 * navigation and its disclosures, the mobile sheet, the footer, and
 * back-to-top.
 */

test.describe('navigation', () => {
  // The desktop row is `hidden lg:block`. Below `lg` the same tree renders in
  // the mobile sheet, which has its own describe block below — testing the
  // desktop row at a phone width would assert against something that is
  // correctly not there.
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a parent is a disclosure button, never a link that also navigates', async ({
    page,
  }) => {
    // One control cannot both navigate and reveal. A parent that is a link
    // steals the click from the submenu, and a keyboard user never reaches the
    // children at all.
    await page.goto('/en');
    const services = page.getByRole('button', { name: /^Services$/ });
    await expect(services).toHaveAttribute('aria-expanded', 'false');
  });

  test('opens on click, and its submenu is a real child of its list item', async ({
    page,
  }) => {
    await page.goto('/en');
    const services = page.getByRole('button', { name: /^Services$/ });
    await services.click();
    await expect(services).toHaveAttribute('aria-expanded', 'true');

    const panelId = await services.getAttribute('aria-controls');
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    // The submenu is a <ul> inside the parent's own <li>, so a reader browsing
    // by structure gets the grouping for free.
    await expect(panel).toHaveJSProperty('tagName', 'UL');
    expect(await panel.evaluate(node => node.parentElement?.tagName)).toBe(
      'LI'
    );
  });

  test('closes on Escape and returns focus to its button', async ({ page }) => {
    await page.goto('/en');
    const services = page.getByRole('button', { name: /^Services$/ });
    await services.click();
    await page.keyboard.press('Escape');
    await expect(services).toHaveAttribute('aria-expanded', 'false');
    await expect(services).toBeFocused();
  });

  test('a destination that does not exist is not a link', async ({ page }) => {
    /*
     * A 404 reached from a site's own navigation reads as a broken site, and
     * this portal cannot afford to look broken while it is asking to be
     * trusted. Unbuilt routes render as marked non-links instead.
     */
    await page.goto('/en');
    await page.getByRole('button', { name: /^Government$/ }).click();
    // The row is a <span aria-disabled> carrying the "Soon" badge, so an
    // exact-text match never finds it — and a `getByRole('link')` finding
    // nothing is exactly the assertion.
    const offices = page.locator('[aria-disabled="true"]', {
      hasText: 'Offices',
    });
    await expect(offices.first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Offices/ })).toHaveCount(0);
  });

  test('the desktop row fits inside the page measure at 1024px, in Filipino', async ({
    page,
  }) => {
    // Filipino is the sizing case: 15-25% longer on every label, and every
    // parent carries a chevron.
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/fil');
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('the mobile sheet', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('opens, and does NOT lock the page behind it', async ({ page }) => {
    /*
     * It is a non-modal disclosure: the page stays visible beneath it, so it
     * must not claim the page is inert. No scroll lock, no dialog role, no
     * focus trap — trapping Tab in a non-modal panel is the specific bug where
     * a keyboard reader cannot get back out.
     */
    await page.goto('/en');
    await page.getByRole('button', { name: /open the menu/i }).click();

    const overflow = await page.evaluate(
      () => getComputedStyle(document.body).overflow
    );
    expect(overflow).not.toBe('hidden');
  });

  test('is bounded by the dynamic viewport height and scrolls itself', async ({
    page,
  }) => {
    // A retracting mobile URL bar is exactly the case `100dvh` exists for.
    await page.goto('/en');
    await page.getByRole('button', { name: /open the menu/i }).click();
    const panel = page.locator('.mobile-nav-panel');
    await expect(panel).toBeVisible();
    expect(await panel.evaluate(node => getComputedStyle(node).overflowY)).toBe(
      'auto'
    );
  });

  test('closes on Escape and returns focus to the burger', async ({ page }) => {
    await page.goto('/en');
    const burger = page.getByRole('button', { name: /open the menu/i });
    await burger.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.mobile-nav-panel')).toBeHidden();
    await expect(
      page.getByRole('button', { name: /open the menu/i })
    ).toBeFocused();
  });

  test('reaches the same destinations as the desktop row', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: /open the menu/i }).click();
    const panel = page.locator('.mobile-nav-panel');
    // Five top-level rows, same tree, same builder.
    for (const label of ['Services', 'Government', 'Emergency', 'Contact']) {
      await expect(panel.getByText(label, { exact: true })).toBeVisible();
    }
  });
});

test.describe('the advisory bar', () => {
  test('🔴 ships absent, not as a specimen', async ({ page }) => {
    /*
     * TAGO-113 asks for a bar that renders ONLY when a verified advisory exists
     * in content. None does — `CONT-107` found nothing this project can cite in
     * a machine-readable form — so the correct state is no bar at all.
     *
     * The temptation this guards against is a permanent placeholder: a bar that
     * is always there teaches people to ignore the one that matters, and the
     * day a real storm notice appears is the day that habit costs something.
     * The dismissal behaviour itself is proven against a fixture in
     * AdvisoryBar.test.tsx, so nothing is untested by the absence.
     */
    await page.goto('/en');
    await expect(
      page.locator('[data-surface="accent"][role="region"]')
    ).toHaveCount(0);
  });
});

test.describe('the hotline ticker', () => {
  test('is readable and scrollable with no JavaScript at all', async ({
    browser,
  }) => {
    /*
     * The marquee is gated on `[data-marquee]`, which only appears once
     * TickerViewport has MEASURED a real overflow. With scripting off the
     * attribute never appears, nothing animates, and the row is a static,
     * scrollable, fully readable line — which is the right direction for a
     * progressive enhancement whose whole job is to move.
     */
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/en');

    const viewport = page.locator('.hotline-viewport');
    await expect(viewport).toBeVisible();
    await expect(viewport).not.toHaveAttribute('data-marquee', 'true');
    await expect(viewport).toContainText('911');
    expect(
      await viewport.evaluate(node => getComputedStyle(node).overflowX)
    ).toBe('auto');

    /*
     * 🔴 The "hover and focus halves work with no JavaScript at all" clause.
     *
     * It cannot be proven by hovering here — with scripting off the marquee
     * never starts, so there is nothing to pause. What CAN be proven, and is
     * what the clause actually protects, is that neither half is implemented in
     * JavaScript: both are declarative rules in the stylesheet the browser
     * already has, so they hold from first paint and do not wait on hydration.
     * A refactor that moved either into `TickerViewport` would still pass every
     * other test in this file.
     */
    const sheets = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll(links => links.map(link => (link as HTMLLinkElement).href));
    const css = (
      await Promise.all(
        sheets.map(async href => await (await page.request.get(href)).text())
      )
    ).join('\n');

    // Whitespace-tolerant: dev CSS is pretty-printed and the production build
    // is minified, and this has to hold in both.
    const PAUSE = /animation-play-state:\s*paused/;
    expect(css).toMatch(
      new RegExp(`:hover[^{}]*\\.hotline-track[^{}]*\\{[^}]*${PAUSE.source}`)
    );
    expect(css).toMatch(
      new RegExp(
        `:focus-within[^{}]*\\.hotline-track[^{}]*\\{[^}]*${PAUSE.source}`
      )
    );

    await context.close();
  });

  for (const width of [1280, 375]) {
    test(`🔴 moves, and every number is still dialable at ${width}px`, async ({
      page,
    }) => {
      /*
       * The two requirements this bar has to hold AT THE SAME TIME, so they are
       * asserted in one test rather than two that could each pass while the
       * pair was broken.
       *
       * It was static for one afternoon, on the reasoning that a sliding
       * `tel:` link cannot be tapped. True, and not a reason to stop: hover,
       * focus and touch all pause it, so the number is standing still by the
       * time a pointer reaches it. This proves the whole sequence — it runs,
       * a hover stops it, and the click then lands on the right href.
       */
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/en');

      const viewport = page.locator('.hotline-viewport');
      // 🔴 The pointer starts at (0,0), which is INSIDE this 28px bar — so it
      // is hovered before the test does anything, the marquee is paused, and a
      // "does it move" reading taken now is false. Measured the hard way.
      await page.mouse.move(width / 2, 600);

      await expect(viewport).toHaveAttribute('data-marquee', 'true');

      const track = page.locator('.hotline-track');
      const before = await track.evaluate(
        node => getComputedStyle(node).transform
      );
      await expect
        .poll(() => track.evaluate(node => getComputedStyle(node).transform))
        .not.toBe(before);

      // Hover anywhere on the bar stops it — pure CSS, so it does not wait on
      // hydration and it is already stopped before the pointer arrives.
      await viewport.hover();
      await expect(track).toHaveCSS('animation-play-state', 'paused');

      /*
       * 🔴 The click itself, ONCE PER RUN — and the second one is the whole
       * point of the loop.
       *
       * The echo first shipped as inert `<span>`s, so for half of every cycle
       * the numbers on screen were dead text that looked exactly like the live
       * ones. A test that only clicked "the first tel: link" passed throughout,
       * because the first one is always in the live run. This walks BOTH.
       *
       * `tel:` is defaulted away so Chromium is not asked to hand off to an
       * external handler mid-test; what is proven is that the element under the
       * pointer IS the anchor carrying that number — which is exactly what
       * fails both when a target slides out from under a click and when the
       * visible copy was never an anchor at all.
       */
      await page.evaluate(() => {
        document
          .querySelectorAll<HTMLAnchorElement>(
            '.hotline-viewport a[href^="tel:"]'
          )
          .forEach(link =>
            link.addEventListener('click', event => {
              event.preventDefault();
              link.dataset.clicked = link.href;
            })
          );
      });

      for (const run of ['.hotline-run:not(.hotline-echo)', '.hotline-echo']) {
        const call = page.locator(`${run} a[href^="tel:"]`).first();
        const href = await call.getAttribute('href');
        expect(href).toMatch(/^tel:/);
        await call.click();
        await expect(call).toHaveAttribute('data-clicked', /^tel:/);
      }

      // The echo gives up its tab stops, never its links — that pairing is what
      // keeps a number from being announced and tabbed twice.
      const echoTabIndexes = await page
        .locator('.hotline-echo a[href^="tel:"]')
        .evaluateAll(links => links.map(l => l.getAttribute('tabindex')));
      expect(echoTabIndexes.length).toBeGreaterThan(0);
      expect(echoTabIndexes.every(value => value === '-1')).toBe(true);
    });
  }

  test('🔴 stops on keyboard focus, on touch and on drag', async ({ page }) => {
    /*
     * The other three halves of TAGO-113's pause criterion. Hover is proven in
     * the test above, as part of the click sequence; these are the ones a
     * marquee usually gets wrong, because each has a different mechanism:
     *
     * · **focus** is `:focus-within` — pure CSS, so a Tab that lands on a
     *   number stops the row without waiting on hydration;
     * · **touch** cannot use `:hover`, which on a touchscreen either never
     *   fires or sticks after the finger lifts. `pointerdown` is unambiguous;
     * · **drag** is the same handler, and it also swaps `overflow-x` back to
     *   `auto` so the row can actually be dragged rather than just stopped.
     */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');

    const viewport = page.locator('.hotline-viewport');
    const track = page.locator('.hotline-track');
    // The pointer starts at (0,0), inside this 28px bar — park it away or
    // every reading below is a hover reading.
    await page.mouse.move(640, 600);
    await expect(viewport).toHaveAttribute('data-marquee', 'true');

    // — focus, with no pointer anywhere near the bar —
    await page.locator('.hotline-viewport a[href^="tel:"]').first().focus();
    await expect(track).toHaveCSS('animation-play-state', 'paused');
    await page.locator('main').first().focus();

    // — touch —
    await viewport.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      bubbles: true,
    });
    await expect(viewport).toHaveAttribute('data-paused', 'true');
    await expect(track).toHaveCSS('animation-play-state', 'paused');
    // Paused, it is a real scroller again — which is what makes a swipe do
    // something rather than merely stopping the row.
    await expect(viewport).toHaveCSS('overflow-x', 'auto');
    await viewport.dispatchEvent('pointerup', {
      pointerType: 'touch',
      bubbles: true,
    });

    // — drag —
    await page.mouse.move(640, 600);
    await expect(viewport).toHaveAttribute('data-paused', 'true');
    const box = await viewport.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 40, box!.y + box!.height / 2);
    await expect(viewport).toHaveAttribute('data-paused', 'true');
    await page.mouse.up();
  });

  test('the national line is dialable from the bar', async ({ page }) => {
    await page.goto('/en');
    const call = page.locator('.hotline-viewport a[href^="tel:"]').first();
    await expect(call).toHaveAttribute('href', 'tel:911');
    // The accessible name carries the organisation, not just the digits.
    await expect(call).toHaveAttribute('aria-label', /national/i);
  });

  test('carries the obtained agencies rather than a gap clause', async ({
    page,
  }) => {
    /*
     * This asserted the OPPOSITE until 2026-08-10 — that the bar stated no
     * municipal number had been published and linked `#emergency` to explain
     * why. Six agencies were then found on the municipality's own Facebook
     * page, so the clause is gone and the numbers are in the bar instead.
     */
    await page.goto('/en');
    const bar = page.locator('.hotline-viewport');

    await expect(bar).not.toContainText(/no municipal hotline/i);
    // The national line plus every obtained number, all dialable from the bar.
    const dialable = await bar
      .locator('a[href^="tel:"]')
      .evaluateAll(links => links.map(l => l.getAttribute('href')));
    expect(dialable).toContain('tel:911');
    expect(dialable.length).toBeGreaterThan(1);
  });
});

test.describe('back to top', () => {
  test('is absent near the top and appears once the reader is deep', async ({
    page,
  }) => {
    await page.goto('/en');
    const button = page.getByRole('button', { name: /back to the top/i });
    await expect(button).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(button).toBeVisible();
  });

  test('returns the reader to the top', async ({ page }) => {
    await page.goto('/en');
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.getByRole('button', { name: /back to the top/i }).click();
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeLessThan(50);
  });

  test('🔴 does not animate the scroll under prefers-reduced-motion', async ({
    browser,
  }) => {
    /*
     * `prefers-reduced-motion` governs the CSS `scroll-behavior` property, NOT
     * `window.scrollTo`. The global reduced-motion rule cannot reach a scroll
     * issued from JavaScript, so the component matches the media query again
     * itself — and this asserts the reader arrives instantly rather than being
     * animated 1500px.
     */
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/en');
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.getByRole('button', { name: /back to the top/i }).click();
    // No polling: with `behavior: 'auto'` the jump is synchronous.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await context.close();
  });
});

test.describe('the footer', () => {
  test('renders four columns with the same wordmark as the header', async ({
    page,
  }) => {
    await page.goto('/en');
    const footer = page.locator('footer');
    for (const heading of ['Pages', 'Resources', 'Contribute']) {
      await expect(footer.getByText(heading, { exact: true })).toBeVisible();
    }
    // Uppercased in CSS, not in the config — the accessible text stays "Tago",
    // which is what keeps WCAG 2.5.3 (Label in Name) satisfied.
    await expect(
      footer.getByText('Tago', { exact: true }).first()
    ).toBeVisible();
  });

  test('🔴 never says Sangguniang Panlungsod, which is a city’s body', async ({
    page,
  }) => {
    /*
     * Tago is a municipality; its legislature is the Sangguniang BAYAN.
     * Copying a city portal's row across would have named the wrong body on
     * every page of this site.
     *
     * The footer ROW was removed on 2026-08-10 (no known website), so the
     * positive half of this assertion moved to `navigation.test.ts`, which
     * checks the string still in both catalogues. What remains here is the
     * half that must hold across the whole rendered page regardless of which
     * rows the footer carries.
     */
    await page.goto('/en');
    await expect(page.locator('body')).not.toContainText(/Panlungsod/i);
  });

  test('lists the Resources column, with the added portals', async ({
    page,
  }) => {
    await page.goto('/en');
    const footer = page.locator('footer');
    await expect(footer.getByText('Resources', { exact: true })).toBeVisible();

    for (const [name, href] of [
      ['PhilGEPS', 'https://www.philgeps.gov.ph/'],
      ['CMCI DTI Portal', 'https://cmci.dti.gov.ph/'],
      ['BLGF Portal', 'https://blgf.gov.ph/'],
      ['Official Gov.PH', 'https://www.gov.ph/'],
    ] as const) {
      await expect(footer.getByRole('link', { name })).toHaveAttribute(
        'href',
        href
      );
    }

    // Removed on 2026-08-10, by instruction.
    await expect(footer).not.toContainText('Sangguniang Bayan');
    await expect(footer).not.toContainText('Philippine Statistics Authority');
  });

  test('carries the version from package.json, not a literal', async ({
    page,
  }) => {
    await page.goto('/en');
    // "Portal version: 0.2.0" — the label is sr-only, the number is not.
    await expect(page.locator('footer')).toContainText(
      /Portal version:\s*\d+\.\d+\.\d+/
    );
  });

  test("states its independence, in BetterTandag's own pattern", async ({
    page,
  }) => {
    // Ported from BetterTandag's footer.about on 2026-08-10, by instruction —
    // "Built by [demonym] for [place]" rather than an explicit "not operated
    // by / endorsed by / affiliated with" disclaimer. `meta.description`
    // still carries the more explicit claim.
    await page.goto('/en');
    await expect(page.locator('footer')).toContainText(
      /Built by Tagon-on for Tago/i
    );
  });

  test('the two Contribute buttons and Source Code link all point at the repository', async ({
    page,
  }) => {
    await page.goto('/en');
    const footer = page.locator('footer');
    for (const name of [
      /volunteer with us/i,
      /contribute code with us/i,
      /source code/i,
    ]) {
      await expect(footer.getByRole('link', { name })).toHaveAttribute(
        'href',
        'https://github.com/BetterTago/better-tago'
      );
    }
  });

  test('links the BetterGov mark to the network site', async ({ page }) => {
    await page.goto('/en');
    const mark = page.locator('footer img[src="/bettergov-white.svg"]');
    await expect(mark).toBeVisible();
    await expect(mark.locator('..')).toHaveAttribute(
      'href',
      'https://bettergov.ph/'
    );
  });

  test('reads the copyright host from the config, not a literal', async ({
    page,
  }) => {
    await page.goto('/en');
    await expect(page.locator('footer')).toContainText(
      '© 2026 BetterTago.org. All rights reserved.'
    );
  });
});
