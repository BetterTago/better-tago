import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localeState } from '@/test/intl-mock';
import { VerificationBadge } from './VerificationBadge';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

describe('VerificationBadge', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('never prints the code', async () => {
    // `V3` is a bookkeeping label this project invented. To a resident it looks
    // like a grade and says nothing about whether the page can be trusted.
    for (const level of ['V3', 'V2', 'V1', 'V0'] as const) {
      const { container, unmount } = render(
        await VerificationBadge({ verification: level })
      );
      expect(container.textContent).not.toMatch(/\bV[0-3]\b/);
      expect(container.textContent!.length).toBeGreaterThan(20);
      unmount();
    }
  });

  it('says a V0 is unconfirmed, in words', async () => {
    /*
     * The schema lets safety-critical information ship at V0 ONLY while it is
     * labelled. A label carried by an amber tint is not a label — this asserts
     * the text itself says it, which is what a reader who cannot see the colour
     * gets.
     */
    render(await VerificationBadge({ verification: 'V0' }));
    expect(screen.getByText(/unconfirmed/i)).toBeInTheDocument();
  });

  it('distinguishes the four levels from each other', async () => {
    const rendered = new Set<string>();
    for (const level of ['V3', 'V2', 'V1', 'V0'] as const) {
      const { container, unmount } = render(
        await VerificationBadge({ verification: level })
      );
      rendered.add(container.textContent!);
      unmount();
    }
    // Four levels collapsing to three sentences would make one of them a lie.
    expect(rendered.size).toBe(4);
  });

  it('translates', async () => {
    localeState.current = 'fil';
    const { container } = render(
      await VerificationBadge({ verification: 'V3' })
    );
    expect(container.textContent).toContain('bayan');
  });
});
