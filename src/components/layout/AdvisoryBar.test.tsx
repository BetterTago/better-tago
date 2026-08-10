import { existsSync, readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvisoryBar } from './AdvisoryBar';

const STORAGE_KEY = 'bt-advisory-dismissed';

/**
 * 🔴 A synthetic advisory, and the wording says so out loud.
 *
 * An advisory fixture is the single most dangerous string in this codebase to
 * make plausible: it is emergency copy, and a specimen that reads like a real
 * storm notice is one copy-paste away from a page a resident loads. Nothing
 * here could be mistaken for a municipal advisory.
 */
const SPECIMEN = {
  advisoryId: 'example-advisory-1',
  body: 'EXAMPLE ADVISORY — not a real notice, used only in tests.',
  regionLabel: 'Advisory',
  badgeLabel: 'Notice',
  dismissLabel: 'Dismiss this advisory',
};

describe('the advisory source — what ships today', () => {
  it('🔴 publishes NO advisory, so the bar never renders', () => {
    /*
     * The "ships dismissed-empty rather than showing a specimen" half of
     * TAGO-113's criterion, asserted against the CONTENT LAYER — which is where
     * the answer actually lives.
     *
     * Not through `getAdvisory()`: it goes through `getManifest`, whose
     * `cacheLife()` only resolves inside the Next runtime, so calling it here
     * throws for a reason that has nothing to do with advisories. The manifest
     * on disk is the same source of truth one step earlier, and reading it
     * needs no runtime at all.
     *
     * `CONT-107` established that nothing this project can cite is published in
     * a machine-readable form, so the honest state is an empty content section
     * — not a placeholder bar. A bar that is always there teaches people to
     * ignore the one that matters, which is the specific harm this guards.
     *
     * Adding one is a CONTENT change: an entry in the manifest below and the
     * bar appears, with no code change at all. This test flips to red on that
     * day, which is correct — it is the reminder that the layout guard has gone
     * live and the e2e expecting no bar needs revisiting with it.
     */
    const manifest = 'content/home/advisories/index.yaml';
    if (!existsSync(manifest)) return;

    const entries = readFileSync(manifest, 'utf8')
      .split('\n')
      .filter(line => /^\s*-\s/.test(line));
    expect(entries).toHaveLength(0);
  });
});

describe('AdvisoryBar — dismissal is remembered by identifier', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the advisory when nothing has been dismissed', () => {
    render(<AdvisoryBar {...SPECIMEN} />);
    expect(screen.getByRole('region', { name: 'Advisory' })).toBeTruthy();
    expect(screen.getByText(SPECIMEN.body)).toBeTruthy();
  });

  it('disappears once dismissed, and stores the ID it dismissed', () => {
    render(<AdvisoryBar {...SPECIMEN} />);

    fireEvent.click(
      screen.getByRole('button', { name: SPECIMEN.dismissLabel })
    );

    expect(screen.queryByRole('region', { name: 'Advisory' })).toBeNull();
    // The ID, not a boolean — see the next test for why that distinction is
    // the whole point.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(SPECIMEN.advisoryId);
  });

  it('stays dismissed on the next render of the SAME advisory', () => {
    localStorage.setItem(STORAGE_KEY, SPECIMEN.advisoryId);
    render(<AdvisoryBar {...SPECIMEN} />);
    expect(screen.queryByRole('region', { name: 'Advisory' })).toBeNull();
  });

  it('🔴 shows a DIFFERENT advisory even after one was dismissed', () => {
    /*
     * The bug the id exists to prevent, and the reason a boolean was never an
     * option: with `dismissed: true` in storage, a real storm notice would
     * never appear for anybody who had dismissed anything before it — silently,
     * and worst for the readers who use the site most.
     */
    localStorage.setItem(STORAGE_KEY, 'example-advisory-1');

    render(<AdvisoryBar {...SPECIMEN} advisoryId="example-advisory-2" />);

    expect(screen.getByRole('region', { name: 'Advisory' })).toBeTruthy();
  });

  it('shows the advisory when localStorage throws, as in private browsing', () => {
    // Failing OPEN is the deliberate choice: a missed dismissal costs a click,
    // a missed advisory could cost more than that.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    render(<AdvisoryBar {...SPECIMEN} />);
    expect(screen.getByRole('region', { name: 'Advisory' })).toBeTruthy();
  });

  it('still dismisses for this view when localStorage cannot persist it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    render(<AdvisoryBar {...SPECIMEN} />);
    fireEvent.click(
      screen.getByRole('button', { name: SPECIMEN.dismissLabel })
    );

    expect(screen.queryByRole('region', { name: 'Advisory' })).toBeNull();
  });
});
