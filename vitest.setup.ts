import '@testing-library/jest-dom/vitest';

/**
 * `window.matchMedia`, which jsdom does not implement at all.
 *
 * Several client leaves ask it whether the reader has requested reduced motion
 * — `CountUp` before it animates a figure, `BackToTop` before it scrolls, and
 * `MobileNav` for the desktop breakpoint. Without a stub, jsdom throws
 * `window.matchMedia is not a function` from inside an effect, which surfaces
 * as a failure in whatever test happened to render the component rather than as
 * anything to do with media queries.
 *
 * 🔑 **The default answer is "no preference".** A stub that reported `reduce`
 * would make every motion assertion pass for the wrong reason — the animation
 * would be skipped, and a test asserting it is skipped would be green whether
 * or not the component ever checked. A test that needs the other answer
 * overrides this deliberately and locally; `BackToTop.test.tsx` is the one that
 * does, because the JS-scroll-versus-CSS distinction is the whole point of it.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}
