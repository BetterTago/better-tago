import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cadenceOf } from '@/lib/freshness';
import { localeState } from '@/test/intl-mock';
import { StalenessNotice } from './StalenessNotice';

vi.mock('next-intl/server', async () => {
  const { intlServerMock } = await import('@/test/intl-mock');
  return intlServerMock();
});

/** `offices` is a 182-day cadence in config/freshness.config.json. */
const CHECKED = '2026-01-01';
const CADENCE = cadenceOf('offices');

/** A day `days` after CHECKED, as YYYY-MM-DD. */
function dayAfterCheck(days: number): string {
  const date = new Date(`${CHECKED}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('StalenessNotice', () => {
  beforeEach(() => {
    localeState.current = 'en';
  });

  it('renders nothing while the page is inside its cadence', async () => {
    const notice = await StalenessNotice({
      dataClass: 'offices',
      lastCheckedAt: CHECKED,
      today: dayAfterCheck(10),
    });
    expect(notice).toBeNull();
  });

  it('stays quiet through the due window, on purpose', async () => {
    /*
     * `due` is the last tenth of the cadence and exists so a review can be
     * SCHEDULED before a reader ever sees a warning. Rendering it here would
     * put a notice on a page that is not actually out of date, and a warning a
     * reader learns to ignore is worse than none.
     */
    const notice = await StalenessNotice({
      dataClass: 'offices',
      lastCheckedAt: CHECKED,
      today: dayAfterCheck(Math.round(CADENCE * 0.95)),
    });
    expect(notice).toBeNull();
  });

  it('names the check date once the page is past its cadence', async () => {
    render(
      await StalenessNotice({
        dataClass: 'offices',
        lastCheckedAt: CHECKED,
        today: dayAfterCheck(CADENCE + 1),
      })
    );

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2026/)).toBeInTheDocument();
  });

  it('takes the cadence from configuration, not from itself', async () => {
    // The number in the sentence has to be the one in freshness.config.json —
    // a cadence written into a component is a cadence that drifts per page.
    render(
      await StalenessNotice({
        dataClass: 'offices',
        lastCheckedAt: CHECKED,
        today: dayAfterCheck(CADENCE + 1),
      })
    );
    expect(screen.getByText(new RegExp(`${CADENCE} days`))).toBeInTheDocument();
  });

  it('says it in words, not in colour', async () => {
    const { container } = render(
      await StalenessNotice({
        dataClass: 'offices',
        lastCheckedAt: CHECKED,
        today: dayAfterCheck(CADENCE + 1),
      })
    );

    // Nothing in the notice is hidden from assistive technology except the
    // decorative icon, and the icon carries none of the meaning.
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden).toHaveLength(1);
    expect(hidden[0].tagName.toLowerCase()).toBe('svg');
    expect(container.textContent).toMatch(/overdue/i);
  });

  it('throws on a check date in the future rather than rendering it as fresh', async () => {
    /*
     * ★ TAGO-104 criterion 5. No real check can produce a future date, so it is
     * a defect — and a defect in a check date has to stop the build rather than
     * make the page look like the best-maintained one on the site. Thrown
     * during render, it fails the prerender and names the page.
     */
    await expect(
      StalenessNotice({
        dataClass: 'offices',
        lastCheckedAt: '2027-01-01',
        today: '2026-08-09',
      })
    ).rejects.toThrow(/in the future/);
  });

  it('refuses a data class that has no cadence behind it', async () => {
    // A page that quietly never goes stale is the failure the class enum
    // exists to prevent, and it is invisible until a fact on it is years old.
    await expect(
      StalenessNotice({
        dataClass: 'invented-class',
        lastCheckedAt: CHECKED,
        today: dayAfterCheck(1),
      })
    ).rejects.toThrow(/unknown data class/);
  });

  it('translates', async () => {
    localeState.current = 'fil';
    render(
      await StalenessNotice({
        dataClass: 'offices',
        lastCheckedAt: CHECKED,
        today: dayAfterCheck(CADENCE + 1),
      })
    );
    expect(screen.getByText(/muling pagsusuri/i)).toBeInTheDocument();
  });
});
