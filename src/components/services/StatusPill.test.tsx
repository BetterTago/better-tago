import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusPill } from './StatusPill';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/**
 * 🔴 **The untranscribed state has no live instance, which is why it is tested
 * here and not in a browser.**
 *
 * All 97 charter records carry `content` as of 2026-08-10, so an end-to-end test
 * of "a service that is not transcribed yet" would pass by rendering nothing at
 * all — the worst kind of green. These assertions run against a synthetic value
 * instead, so the branch a future untranscribed service will take is proven now
 * rather than the first time somebody adds one.
 */
describe('StatusPill', () => {
  it('says which state it is in, in words rather than in colour', async () => {
    // A reader who cannot distinguish the green ground from the amber one still
    // has to be able to tell these two apart. That is the whole contract.
    const { container: ok, unmount } = render(
      await StatusPill({ transcribed: true })
    );
    const transcribed = ok.textContent!;
    unmount();

    const { container: gap } = render(await StatusPill({ transcribed: false }));
    const untranscribed = gap.textContent!;

    expect(transcribed).not.toBe(untranscribed);
    expect(transcribed.length).toBeGreaterThan(10);
    expect(untranscribed.length).toBeGreaterThan(10);
  });

  it('names what the page carries when the charter contents are on it', async () => {
    render(await StatusPill({ transcribed: true }));
    expect(screen.getByText(/requirements/i)).toBeInTheDocument();
  });

  it('says a service is not yet transcribed rather than hiding it', async () => {
    /*
     * The alternative — withholding a service until its detail is ready — reads
     * as "the municipality does not provide this". Publishing it with an honest
     * label says the opposite: the service exists, this office provides it, and
     * this portal does not carry the detail yet.
     */
    render(await StatusPill({ transcribed: false }));
    expect(screen.getByText(/not yet transcribed/i)).toBeInTheDocument();
  });

  it('carries a category for a reader meeting it with no context', async () => {
    // Screen-reader only: visible text would repeat what the pill already says.
    const { container } = render(await StatusPill({ transcribed: true }));
    expect(container.querySelector('.sr-only')?.textContent).toBeTruthy();
  });
});
