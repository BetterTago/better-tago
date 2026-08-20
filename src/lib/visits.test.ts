import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VISIT_STORAGE_KEY,
  VISIT_WINDOW_MS,
} from '@/components/layout/VisitCount';
import { REPO_ROOT } from '@/lib/file-scan';

/**
 * `TAGO-116`. The two negative criteria are the point of this file.
 *
 * A counter that counts slightly wrong is a cosmetic defect. A counter that
 * quietly starts processing personal data, or that prints `0` visits it never
 * counted, is the kind of defect this project exists to not have — so both are
 * asserted structurally rather than left to a reviewer.
 */

describe('🔒 nothing personal is read, stored, or transmitted', () => {
  /*
   * The load-bearing test. `docs/governance.md` § *What we never ask for* opens
   * "No personal information is collected, published, or required", and this is
   * what keeps that sentence true after a counter shipped.
   *
   * It scans the SOURCE rather than exercising the handler, deliberately: the
   * claim is that the capability is absent, not that one code path happens not
   * to use it. A behavioural test passes just as happily on a file that reads an
   * IP down a branch nobody triggered.
   */
  const read = (relative: string) =>
    readFileSync(path.join(REPO_ROOT, relative), 'utf8');

  /**
   * The file with its comments removed.
   *
   * 🔴 Load-bearing, and it went red first without it. These files EXPLAIN at
   * length that they read no IP, hash nothing and define no `NEXT_PUBLIC_`
   * variable — so a scan over raw text fires on the prose that documents the
   * rule. `guardrails.test.ts` records the same lesson from its own
   * `export const dynamic` scan: *"a guardrail that fails on its own
   * documentation teaches people to delete the documentation."*
   *
   * So the scans below read CODE. The comments are the argument; the code is
   * the claim.
   */
  const code = (relative: string) =>
    read(relative)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const SURFACES = [
    'src/app/api/visits/route.ts',
    'src/lib/visits.ts',
    'src/components/layout/VisitCount.tsx',
  ];

  it('is actually reading the files', () => {
    for (const file of SURFACES) {
      expect(read(file).length, file).toBeGreaterThan(500);
    }
  });

  it('reads no IP address, and derives nothing from one', () => {
    /*
     * `x-forwarded-for` and `x-real-ip` are how an IP reaches a handler behind
     * a proxy; `request.ip` is how it reached one directly. None may appear.
     */
    const IP =
      /x-forwarded-for|x-real-ip|cf-connecting-ip|\brequest\.ip\b|\bremoteAddress\b/i;
    const offenders = SURFACES.filter(file => IP.test(code(file)));
    expect(offenders).toEqual([]);
  });

  it('hashes nothing, and stores no identifier', () => {
    // The companion spec proposed a salted rotating hash of IP + user agent.
    // It was dropped rather than implemented; this is what keeps it dropped.
    const IDENTIFIER =
      /createHash|webcrypto|crypto\.subtle|digest\(|\bhmac\b|\bsalt\b|fingerprint|setCookie|cookies\(\)/i;
    const offenders = SURFACES.filter(file => IDENTIFIER.test(code(file)));
    expect(offenders).toEqual([]);
  });

  it('strips comments before scanning, and is not vacuous afterwards', () => {
    // If the stripper ate everything, every scan above would pass on nothing.
    for (const file of SURFACES) {
      expect(code(file).length, file).toBeGreaterThan(200);
      expect(code(file)).toContain('export');
    }
  });

  it('fires on a doctored fixture', () => {
    // A guardrail that has never gone red is not known to work.
    const IP = /x-forwarded-for|x-real-ip|cf-connecting-ip|\brequest\.ip\b/i;
    expect(IP.test("request.headers.get('x-forwarded-for')")).toBe(true);
  });

  it('uses the user agent only as a discarded crawler check', () => {
    /*
     * The handler DOES read `user-agent` — to refuse declared crawlers — and
     * that is legitimate precisely because the value is tested and dropped. It
     * must never reach the store or be combined with anything.
     */
    const handler = code('src/app/api/visits/route.ts');
    expect(handler).toContain("headers.get('user-agent')");
    expect(handler).not.toMatch(/recordVisit\([^)]+\)/);
  });

  it('introduces no NEXT_PUBLIC_ variable', () => {
    // `.env.example` is a comment file end to end, so it is stripped too:
    // it NAMES the prohibition and must not be caught stating it.
    const all = [...SURFACES]
      .map(code)
      .concat(read('.env.example').replace(/^\s*#.*$/gm, ''))
      .join('\n');
    expect(all).not.toMatch(/NEXT_PUBLIC_/);
  });

  it('keeps the governance sentence it depends on intact', () => {
    /*
     * If someone amends this sentence, the counter's whole privacy design has
     * changed and this test should be the thing that says so.
     */
    expect(read('docs/governance.md')).toContain(
      'No personal information is collected, published, or required'
    );
  });
});

describe('the 24-hour deduplication window', () => {
  const NOW = 1_800_000_000_000;

  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => vi.restoreAllMocks());

  /** The component's own predicate, re-derived from its exported constants. */
  const countedRecently = (stored: string | null) => {
    if (!stored) return false;
    const last = Number(stored);
    if (!Number.isFinite(last) || last <= 0) return false;
    return NOW - last < VISIT_WINDOW_MS && NOW - last >= 0;
  };

  it('exports a window of exactly 24 hours', () => {
    expect(VISIT_WINDOW_MS).toBe(86_400_000);
    expect(VISIT_STORAGE_KEY).toBe('bettertago-counted');
  });

  it('suppresses a repeat inside the window', () => {
    expect(countedRecently(String(NOW - 1))).toBe(true);
    expect(countedRecently(String(NOW - VISIT_WINDOW_MS + 1))).toBe(true);
  });

  it('🔴 counts again at exactly 24 hours, not a millisecond later', () => {
    // The boundary belongs to the NEXT window. Off-by-one here is the classic
    // bug, and it is invisible in production.
    expect(countedRecently(String(NOW - VISIT_WINDOW_MS))).toBe(false);
    expect(countedRecently(String(NOW - VISIT_WINDOW_MS - 1))).toBe(false);
  });

  it('counts when the marker is missing, empty, or junk', () => {
    // `Number('')` is 0 and `Number('nonsense')` is NaN. Neither may read as a
    // timestamp at the epoch, which would suppress the count forever.
    for (const stored of [null, '', 'nonsense', '0', '-1']) {
      expect(countedRecently(stored), JSON.stringify(stored)).toBe(false);
    }
  });

  it('counts when the clock has moved backwards', () => {
    // A corrected device clock gives a marker in the future. Suppressing until
    // the clock catches up would silently stop counting that browser.
    expect(countedRecently(String(NOW + 60_000))).toBe(false);
  });
});

describe('the preview count', () => {
  /*
   * `VISITOR_COUNT_PREVIEW` renders a stand-in figure so the footer can be
   * looked at before a store exists. It publishes a number that is not true,
   * which is the one thing this portal is built never to do — so what is
   * asserted here is the guard, not the feature.
   *
   * The module reads `process.env` at load, so each case re-imports it with the
   * environment already stubbed. `vi.resetModules()` is what makes that real
   * rather than returning the first-loaded copy.
   */
  /*
   * `readVisitCount`, not `getVisitCount` — the cached wrapper carries
   * `'use cache'`, which only resolves inside the Next runtime, so it cannot be
   * called from a unit test at all. Everything that can be wrong lives in the
   * uncached half, which is exactly why the two are split.
   */
  const load = async (env: Record<string, string | undefined>) => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) vi.stubEnv(key, '');
      else vi.stubEnv(key, value);
    }
    return import('@/lib/visits');
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('renders the stand-in when no store is configured', async () => {
    const { readVisitCount } = await load({ VISITOR_COUNT_PREVIEW: '12480' });
    await expect(readVisitCount()).resolves.toBe(12480);
  });

  it('🔴 never outranks a real store', async () => {
    /*
     * The guard that matters. A preview value must not be able to override,
     * mask, or "correct" a live count — if a store is configured, the store is
     * the answer even when it fails, because a failed read means this portal
     * does not know the number and must say nothing.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 7 }) })
    );
    const { readVisitCount } = await load({
      VISITOR_STORE_URL: 'https://store.example',
      VISITOR_STORE_TOKEN: 'token',
      VISITOR_COUNT_PREVIEW: '999999',
    });
    await expect(readVisitCount()).resolves.toBe(7);
  });

  it('🔴 stays silent when a configured store fails, even with a preview set', async () => {
    // The dangerous case: a real deployment whose store is down must render
    // nothing, not fall back to a fabricated figure.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    const { readVisitCount } = await load({
      VISITOR_STORE_URL: 'https://store.example',
      VISITOR_STORE_TOKEN: 'token',
      VISITOR_COUNT_PREVIEW: '999999',
    });
    await expect(readVisitCount()).resolves.toBeNull();
  });

  it('renders nothing for a malformed preview value', async () => {
    for (const value of ['', 'lots', '-1', '12.5', 'NaN']) {
      const { readVisitCount } = await load({ VISITOR_COUNT_PREVIEW: value });
      await expect(readVisitCount(), value).resolves.toBeNull();
    }
  });

  it('renders nothing when no preview and no store are set', async () => {
    const { readVisitCount } = await load({});
    await expect(readVisitCount()).resolves.toBeNull();
  });
});
