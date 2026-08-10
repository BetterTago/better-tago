import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { settleAnimations } from './settle';

/**
 * Axe catches roughly a third of real accessibility problems. It is the floor,
 * not the ceiling — tab through the page yourself before calling a route done.
 */
const ROUTES = ['', '/gaps', '/search'];

/*
 * Both themes and both locales, because both themes are a gate rather than a
 * preference — and because contrast is the failure mode a dark theme
 * introduces, which is precisely what axe is good at catching.
 *
 * The theme is set through the OS preference on a fresh context rather than by
 * clicking the toggle: that exercises the pre-paint script, which is the path a
 * real first visit takes.
 */
for (const colorScheme of ['light', 'dark'] as const) {
  for (const locale of ['en', 'fil']) {
    for (const route of ROUTES) {
      test(`@a11y ${route || '/'} has no axe violations in ${locale}, ${colorScheme}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({ colorScheme });
        const page = await context.newPage();
        await page.goto(`/${locale}${route}`);
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme
        );

        // Entrance animations must finish first — axe measures a mid-fade
        // element as genuinely translucent and reports contrast that is not a
        // real defect. See settle.ts.
        await settleAnimations(page);

        /*
         * 🔴 The hotline bar is EXCLUDED, and this is the reason — it is a
         * listed, reviewed exemption rather than a rule quietly switched off.
         *
         * axe resolves an element's background by hit-testing its centre point.
         * The bar is a horizontal scroller whose content is wider than a phone
         * (582px in English, 700px in Filipino, against a 375px viewport), so
         * everything past the right edge hit-tests against the PAGE and axe
         * reports `#fdc9c5` on `#f3f7f4` — 1.35:1 against a colour that text
         * never sits on. Freezing the marquee and start-aligning the track both
         * helped and neither fixes it, because a static scrollable row still
         * has off-screen content. It is a limitation of measuring a scroll
         * container, not a defect in the bar.
         *
         * What covers it instead, so nothing here is untested:
         *
         * · `theme-tokens.test.ts` COMPUTES every colour pair this surface
         *   renders against its real ground (`error-950`) — resting and hovered,
         *   ink, label, separator — and fails the build on any that drops below
         *   its floor. That is stronger than a hit test, not weaker.
         * · `chrome.spec.ts` asserts the bar's semantics in a browser: the
         *   `tel:` link, its accessible name, the gap link, and that it stays
         *   readable and scrollable with JavaScript disabled.
         * · `HotlineTicker.test.tsx` asserts the echo is `aria-hidden` and
         *   contributes no links, so it is never read twice.
         *
         * Everything else on the page is still analysed in full.
         */
        const results = await new AxeBuilder({ page })
          .exclude('.hotline-viewport')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await context.close();
      });
    }
  }
}

test('@a11y the first tab stop is the skip link, and it becomes visible', async ({
  page,
}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveText(/skip to content/i);
  // A skip link that stays invisible on focus is worse than none — a keyboard
  // user cannot tell it fired.
  await expect(focused).toBeInViewport();
});

test('@a11y every interactive target is at least 44px, or is a listed exemption', async ({
  page,
}) => {
  await page.goto('/en');

  /*
   * ## The exemption list, which is a reviewed decision and not an omission
   *
   * Two classes of control on this page are deliberately under 44px, and both
   * are listed here rather than silently skipped — an exemption nobody wrote
   * down is indistinguishable from a bug nobody noticed, and this list is what
   * stops it creeping.
   *
   * · **The hotline ticker's links.** The bar is 28px tall. Making it 44px
   *   would take a fifth of a phone's viewport for a strip that scrolls past.
   *   The same number sits in `#emergency` as a 64px call band, which is the
   *   target anybody dialling in a storm will actually use.
   *
   * · **Inline links inside a paragraph** (WCAG 2.5.8's own inline exception) —
   *   a citation link in a sentence cannot be padded to 44px without breaking
   *   the line it sits in.
   *
   * · **Footer links.** `min-h-5` (20px) rather than the 44px floor, matching
   *   BetterTandag's own footer exactly, by instruction on 2026-08-10 — its
   *   own a11y spec documents the same exemption, for the same reason: the
   *   Pages and Elsewhere columns read as a dense reference list at the
   *   bottom of the page, not as primary controls. This is NOT an oversight
   *   restored to 44px later without noticing — removing this line should
   *   mean the footer's links were widened back, not that the rule quietly
   *   stopped being checked.
   *
   * · **The header's theme toggle and locale switch** (`[data-control]`) —
   *   28px, by instruction, so the header row stays light. Both were 44px and
   *   were reduced deliberately; each keeps a visible border precisely because
   *   the size no longer carries it. Removing this line should mean they were
   *   restored to 44px, not that the rule stopped being checked.
   *
   * `:not(.sr-only)` is not an exemption but a measurement correction: the skip
   * link is clipped to 1px until focused, which is the point of it, and it is
   * measured in its focused state by the test below.
   *
   * Scoped to our own chrome because `webServer` runs `next dev` and the dev
   * overlay injects its own button into the same document.
   */
  const EXEMPT = ['.hotline-viewport', 'p', 'footer a', '[data-control]'];

  const targets = page
    .locator('header, main, footer')
    .locator('a:visible:not(.sr-only), button:visible:not(.sr-only)');
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);

  let measured = 0;
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const exempt = await target.evaluate(
      (node, selectors) => selectors.some(sel => node.closest(sel) !== null),
      EXEMPT
    );
    if (exempt) continue;

    const box = await target.boundingBox();
    if (!box) continue;
    measured += 1;
    expect(
      Math.max(box.height, box.width),
      `target ${index}: ${await target.evaluate(e => e.outerHTML.slice(0, 160))}`
    ).toBeGreaterThanOrEqual(44);
  }

  // The exemption list must not swallow the whole page.
  expect(measured).toBeGreaterThan(10);
});

test('@a11y the skip link is a real target once it is focused', async ({
  page,
}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  const box = await page.locator(':focus').boundingBox();
  expect(box).not.toBeNull();
  expect(Math.max(box!.height, box!.width)).toBeGreaterThanOrEqual(44);
});

test('@a11y every in-page anchor clears the sticky header', async ({
  page,
}) => {
  /*
   * The header is sticky. Without `scroll-margin-top` on every section, an
   * in-page link lands with its own heading tucked underneath the bar that just
   * scrolled over it — the reader arrives at a section and cannot see its name.
   */
  await page.goto('/en');
  const headerHeight =
    (await page.locator('header').first().boundingBox())?.height ?? 0;

  for (const anchor of [
    'services',
    'history',
    'emergency',
    'getting-here',
    'contact',
  ]) {
    await page.goto(`/en#${anchor}`);
    const box = await page.locator(`#${anchor}`).boundingBox();
    expect(box, `#${anchor} is missing`).not.toBeNull();
    expect(
      box!.y,
      `#${anchor} lands under the sticky header`
    ).toBeGreaterThanOrEqual(headerHeight - 1);
  }
});
