import type { Page } from '@playwright/test';

/**
 * Wait for the page's entrance animations to finish.
 *
 * 🔴 **Without this, axe measures contrast MID-FADE and reports failures that
 * are not there.** The entrance utilities animate `opacity: 0 → 1`, so an
 * element caught halfway is genuinely translucent: the hero's call-to-action
 * was reported at 1.97:1 against a colour (`#98bcad`) that appears nowhere in
 * the palette, because it was the band colour composited over the page at
 * roughly half opacity.
 *
 * The alternative — running the whole suite under `reducedMotion: 'reduce'` —
 * would hide the animated page from the accessibility checks entirely, and the
 * animated page is the one most readers actually see.
 *
 * ## Two classes of animation are deliberately NOT awaited
 *
 * · **Infinite** ones — the ticker marquee, the advisory's pulsing dot. Their
 *   `finished` promise never resolves.
 * · **Scroll-driven** ones — `reveal-on-scroll` runs on `animation-timeline:
 *   view()`, so it is bound to the scroll position rather than to time and does
 *   not complete until the element has been scrolled through. Awaiting one
 *   hangs the test until Playwright kills it, which surfaces as
 *   `page.evaluate: Test ended` and looks nothing like the cause.
 *
 * The whole thing is additionally raced against a short deadline, so a future
 * animation nobody anticipated slows a test down rather than hanging it.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settled = document
      .getAnimations()
      .filter(animation => {
        const timing = animation.effect?.getComputedTiming();
        if ((timing?.iterations ?? 1) === Infinity) {
          /*
           * 🔴 An infinite animation is FROZEN AT ITS START rather than skipped.
           *
           * axe resolves an element's background by hit-testing it. The hotline
           * marquee translates its track past the edge of the viewport, so
           * mid-cycle the hit test lands on the page instead of the bar and axe
           * reports `#fdc9c5` on `#f3f7f4` — a failure against a ground the
           * text never actually sits on. The same numbers measure 12.43:1
           * against their real ground in `theme-tokens.test.ts`.
           *
           * Rewinding to 0 puts the track back inside its bar, which is exactly
           * what a reduced-motion reader sees, and lets axe measure the colours
           * that are really there. It is a measurement correction, not an
           * exemption: the ticker is still analysed in full.
           */
          animation.currentTime = 0;
          animation.pause();
          return false;
        }
        /*
         * 🔴 A scroll-driven animation is FINISHED, not awaited and not
         * skipped.
         *
         * `reveal-on-scroll` runs on `animation-timeline: view()`, so its
         * progress is the scroll position rather than time: a section half in
         * view sits at half opacity, indefinitely. Awaiting it hangs the test;
         * skipping it leaves axe measuring translucent text and reporting
         * blended colours (`#747975` on `#fafcfa`) that exist nowhere in the
         * palette.
         *
         * Seeking to the end is the settled state — what a reader sees a moment
         * after the section arrives, and exactly what a reduced-motion reader
         * sees immediately. It surfaced the day the hero shortened and the stat
         * band moved up into the first screen.
         */
        if (!(animation.timeline instanceof DocumentTimeline)) {
          animation.finish();
          return false;
        }
        return true;
      })
      // A cancelled animation rejects; that is settled too, and it is not a
      // failure of the page.
      .map(animation => animation.finished.catch(() => {}));

    await Promise.race([
      Promise.all(settled),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
  });
}
