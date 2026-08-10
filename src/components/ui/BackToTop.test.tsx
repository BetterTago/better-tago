import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackToTop } from './BackToTop';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

/** Drives `window.matchMedia`, which jsdom does not implement. */
function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { writable: true, value: y });
  fireEvent.scroll(window);
}

describe('BackToTop', () => {
  beforeEach(() => {
    setReducedMotion(false);
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 });
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is absent from the DOM near the top, not merely hidden', () => {
    // Absent, so there is nothing to tab into and nothing for a screen reader
    // to find while the control is not being offered.
    const { container } = render(<BackToTop />);
    expect(container.firstChild).toBeNull();
  });

  it('appears past the scroll threshold', () => {
    render(<BackToTop />);
    scrollTo(900);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('appears immediately for a reader who ARRIVES scrolled', () => {
    /*
     * A deep anchor, or a browser restoring a scroll position, fires no scroll
     * event. Evaluating only on scroll would leave the control missing until
     * the reader moved — which is exactly when they least need to.
     */
    Object.defineProperty(window, 'scrollY', { writable: true, value: 1200 });
    render(<BackToTop />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('scrolls smoothly by default', () => {
    render(<BackToTop />);
    scrollTo(900);
    fireEvent.click(screen.getByRole('button'));
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('🔴 does NOT animate the scroll under prefers-reduced-motion', () => {
    /*
     * The assertion this component exists for.
     *
     * `prefers-reduced-motion` governs the CSS `scroll-behavior` property, NOT
     * the `window.scrollTo` API. The global reduced-motion rule in globals.css
     * cannot reach a scroll issued from JavaScript, so the media query has to
     * be matched again here or a reader who explicitly asked not to be moved
     * gets a 700px animated scroll anyway.
     *
     * It is a WCAG 2.3.3 failure, it is green in every automated a11y check,
     * and it is invisible in review — which is why it is pinned by a test.
     */
    setReducedMotion(true);
    render(<BackToTop />);
    scrollTo(900);
    fireEvent.click(screen.getByRole('button'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('names itself for a screen reader, not by icon alone', () => {
    render(<BackToTop />);
    scrollTo(900);
    expect(screen.getByRole('button').textContent).toBe('backToTop');
  });
});
