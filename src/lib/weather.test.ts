import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIMEOUT_MS, fetchWeather } from '@/lib/weather';
import { KNOWN_WEATHER_CODES, conditionKey } from '@/lib/weather-codes';
import en from '../../messages/en.json';
import fil from '../../messages/fil.json';

/**
 * `TAGO-115`. Two things are proven here and they are not the same kind of
 * thing: that the code→label mapping is TOTAL, and that the vocabulary is safe.
 *
 * ## Why the resilience contract is proven HERE and not end-to-end
 *
 * 🔴 It was written as a Playwright test first, aborting the upstream with
 * `page.route()`, and that **silently did not work**: `fetchWeather` runs on the
 * SERVER and Playwright intercepts only the BROWSER, so those tests were
 * quietly hitting the real Open-Meteo and passing or failing on whether it
 * happened to be up. Exactly the CI flake the pattern warns about, introduced by
 * the test meant to prevent it.
 *
 * So `getWeather` — the `'use cache'` wrapper, which cannot run outside the Next
 * runtime — is a thin shell, and everything that can fail lives in
 * `fetchWeather`, which is an ordinary async function a test can reach.
 */

afterEach(() => vi.restoreAllMocks());

const conditions = en.weather.conditions as Record<string, string>;
const conditionsFil = fil.weather.conditions as Record<string, string>;

describe('the WMO code mapping', () => {
  it('is actually reading the catalogue', () => {
    // A scan that silently reads nothing is a green no-op.
    expect(KNOWN_WEATHER_CODES.length).toBe(28);
    expect(Object.keys(conditions).length).toBe(29);
  });

  it('maps every documented code to a key that exists in both catalogues', () => {
    for (const code of KNOWN_WEATHER_CODES) {
      const key = conditionKey(code);
      expect(key, `code ${code}`).not.toBe('unknown');
      expect(conditions, `code ${code} → ${key}`).toHaveProperty(key);
      expect(conditionsFil, `code ${code} → ${key}`).toHaveProperty(key);
    }
  });

  it('falls back to a STATED label for a code it does not know', () => {
    /*
     * The failure this prevents is a blank where a condition should be, which
     * reads as a rendering bug rather than as what it is. Every one of these is
     * a value the upstream could return tomorrow.
     */
    for (const code of [4, 30, 100, -1, 999, Number.NaN]) {
      expect(conditionKey(code)).toBe('unknown');
    }
    expect(conditions.unknown.length).toBeGreaterThan(0);
    expect(conditionsFil.unknown.length).toBeGreaterThan(0);
  });

  it('does not gloss code 82 as "violent" or qualify code 95', () => {
    /*
     * Both are deliberate departures from the WMO gloss and both are editorial
     * rather than cosmetic — a severity word beside a temperature reads as an
     * official severity term. Asserted so a later "correction" back to the
     * standard wording has to argue with a red test.
     */
    expect(conditions[conditionKey(82)]).toBe('Heavy rain showers');
    expect(conditions[conditionKey(95)]).toBe('Thunderstorms');
  });
});

describe('the vocabulary cannot be mistaken for a warning', () => {
  /*
   * `TAGO-115` criterion 5, made checkable. These words belong to the advisory
   * bar and the emergency routes; a forecast strip borrowing them borrows an
   * authority this project does not have, on a civic site in a municipality
   * that faces the Pacific.
   *
   * Word-boundaried, not substring-matched: "signal" must fire, and it must not
   * fire on a word that merely contains it.
   */
  const FORBIDDEN =
    /\b(warning|alert|advisory|signal|severe|danger|emergency|babala|senyales|panganib|matinding|delikado)\b/i;

  const strings = (block: unknown, prefix: string): [string, string][] =>
    Object.entries(block as Record<string, unknown>).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [[`${prefix}${key}`, value] as [string, string]]
        : strings(value, `${prefix}${key}.`)
    );

  const all = [
    ...strings(en.weather, 'en.weather.'),
    ...strings(fil.weather, 'fil.weather.'),
  ];

  it('is actually reading both catalogues', () => {
    expect(all.length).toBe(84);
  });

  it('fires on a doctored fixture', () => {
    // A guardrail that has never gone red is not known to work.
    expect(FORBIDDEN.test('Storm warning in effect')).toBe(true);
    expect(FORBIDDEN.test('May babala ngayon')).toBe(true);
  });

  it('does not fire on the words the strip legitimately uses', () => {
    expect(FORBIDDEN.test('Heavy rain showers')).toBe(false);
    expect(FORBIDDEN.test('Malakas na pabugso-bugsong ulan')).toBe(false);
  });

  it('🔴 uses no warning vocabulary anywhere in the weather namespace', () => {
    const offenders = all
      .filter(([, value]) => FORBIDDEN.test(value))
      .map(([key, value]) => `${key} → "${value}"`);
    expect(offenders).toEqual([]);
  });

  it('names the actual authority in its deference line, in both locales', () => {
    /*
     * The one place the strip is allowed to point at a weather authority, and
     * it must actually do so — an unattributed "this is not official" tells a
     * reader nothing about where to go instead.
     */
    expect(en.weather.notAdvisory).toContain('PAGASA');
    expect(fil.weather.notAdvisory).toContain('PAGASA');
  });

  it('attributes the source in both locales, per CC BY 4.0', () => {
    for (const value of [en.weather.attribution, fil.weather.attribution]) {
      expect(value).toContain('Open-Meteo');
      expect(value).toContain('CC BY 4.0');
    }
  });
});

describe('🔴 the loader returns null and never throws', () => {
  /*
   * `TAGO-115` criterion 3, and the one contract the whole design rests on:
   * *a third-party outage is not a page outage.* Each case below produced a
   * different exception or a different wrong value before the guards existed.
   */
  const ok = (body: unknown) =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => body });

  it('is actually calling fetch', async () => {
    // Without this, every case below could pass on a function that returns
    // early and never reaches the network at all.
    const spy = ok({
      utc_offset_seconds: 28800,
      current: {
        time: '2026-08-20T14:00',
        temperature_2m: 29,
        relative_humidity_2m: 70,
        wind_speed_10m: 10,
        weather_code: 0,
      },
      hourly: {
        time: ['2026-08-20T15:00'],
        temperature_2m: [28],
        weather_code: [0],
      },
      daily: { precipitation_probability_max: [10] },
    });
    vi.stubGlobal('fetch', spy);

    await fetchWeather();
    expect(spy).toHaveBeenCalledTimes(1);

    const url = new URL(String(spy.mock.calls[0][0]));
    expect(url.origin).toBe('https://api.open-meteo.com');
    // The coordinates come from the config, never from a literal here.
    expect(url.searchParams.get('latitude')).toBe('9.0198');
    expect(url.searchParams.get('longitude')).toBe('126.2332');
    expect(url.searchParams.get('timezone')).toBe('Asia/Manila');
  });

  it('🔴 allows enough time for a COLD connection, not just a warm one', () => {
    /*
     * This is the assertion that would have caught the bug, and the reason the
     * one below was not enough: it proved a timeout EXISTED while the value was
     * wrong, so the feature failed closed on every render and every test still
     * passed.
     *
     * At 2,500 ms the strip never showed a reading once — in dev or in a
     * production build — against a healthy upstream. A cold Node `fetch` pays
     * DNS and a TLS handshake that a pooled `curl` does not; measured cold calls
     * ran 1.6 s and, minutes earlier, over 2.5 s.
     *
     * The floor is 5 s because that clears the observed cold-start distribution
     * with real margin. Anyone tightening this below it is re-introducing a
     * silent failure, and should read the note on the constant first — the bound
     * is never in a reader's path, so a short one buys nothing.
     */
    expect(TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
  });

  it('time-boxes the request', async () => {
    const spy = ok({
      utc_offset_seconds: 28800,
      current: {
        time: '2026-08-20T14:00',
        temperature_2m: 29,
        relative_humidity_2m: 70,
        wind_speed_10m: 10,
        weather_code: 0,
      },
      hourly: {
        time: ['2026-08-20T15:00'],
        temperature_2m: [28],
        weather_code: [0],
      },
      daily: { precipitation_probability_max: [10] },
    });
    vi.stubGlobal('fetch', spy);

    await fetchWeather();
    const init = spy.mock.calls[0][1] as RequestInit;
    // An upstream that never answers must never hold a render open.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns null when the network throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('dns')));
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it('returns null when the request aborts', async () => {
    const abort = new DOMException('aborted', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it('returns null on a non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it('returns null on a body that is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })
    );
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it('🔴 returns null on a 200 whose SHAPE is wrong', async () => {
    /*
     * The case `response.ok` misses entirely, and the reason the payload goes
     * through Zod rather than a cast. Without it these render as `undefined°C`.
     */
    for (const body of [
      {},
      { unexpected: true },
      { current: { time: '', temperature_2m: 29, weather_code: 0 } },
      {
        current: { time: 'x', temperature_2m: 'warm', weather_code: 0 },
        daily: { precipitation_probability_max: [1] },
      },
      {
        current: { time: 'x', temperature_2m: 29, weather_code: 1.5 },
        daily: { precipitation_probability_max: [1] },
      },
      {
        current: { time: 'x', temperature_2m: 29, weather_code: 0 },
        daily: { precipitation_probability_max: [] },
      },
      null,
    ]) {
      vi.stubGlobal('fetch', ok(body));
      await expect(fetchWeather(), JSON.stringify(body)).resolves.toBeNull();
    }
  });

  it('rounds every figure and passes the code through untouched', async () => {
    vi.stubGlobal(
      'fetch',
      ok({
        utc_offset_seconds: 28800,
        current: {
          time: '2026-08-20T14:00',
          temperature_2m: 29.6,
          relative_humidity_2m: 74.4,
          wind_speed_10m: 12.7,
          weather_code: 82,
        },
        hourly: {
          time: ['2026-08-20T13:00', '2026-08-20T15:00', '2026-08-20T16:00'],
          temperature_2m: [28.1, 30.4, 29.8],
          weather_code: [3, 61, 80],
        },
        daily: { precipitation_probability_max: [70] },
      })
    );
    await expect(fetchWeather()).resolves.toEqual({
      temperatureC: 30,
      weatherCode: 82,
      humidity: 74,
      windKph: 13,
      rainChance: 70,
      // 🔴 13:00 is DROPPED — it is before the current reading. The upstream
      // returns the whole day from midnight, so without this filter the card
      // shows "1 PM · 28°" beside a 2 PM reading, which reads as a broken
      // widget rather than as history.
      outlook: [
        { at: '2026-08-20T15:00+08:00', temperatureC: 30, weatherCode: 61 },
        { at: '2026-08-20T16:00+08:00', temperatureC: 30, weatherCode: 80 },
      ],
      observedAt: '2026-08-20T14:00+08:00',
    });
  });

  it('returns an empty outlook rather than failing when the hours are ragged', async () => {
    // Parallel arrays can be short or holed. Two missing cells cost nothing;
    // a NaN beside a real temperature would cost the reader's trust in both.
    vi.stubGlobal(
      'fetch',
      ok({
        utc_offset_seconds: 28800,
        current: {
          time: '2026-08-20T23:00',
          temperature_2m: 25,
          relative_humidity_2m: 80,
          wind_speed_10m: 8,
          weather_code: 3,
        },
        hourly: {
          time: ['2026-08-20T22:00'],
          temperature_2m: [26],
          weather_code: [3],
        },
        daily: { precipitation_probability_max: [10] },
      })
    );
    const reading = await fetchWeather();
    expect(reading?.outlook).toEqual([]);
    expect(reading?.temperatureC).toBe(25);
  });

  it('tolerates a null rain probability without losing the reading', async () => {
    // The upstream may omit it. That is not a reason to drop the temperature.
    vi.stubGlobal(
      'fetch',
      ok({
        utc_offset_seconds: 28800,
        current: {
          time: '2026-08-20T14:00',
          temperature_2m: 29,
          relative_humidity_2m: 70,
          wind_speed_10m: 10,
          weather_code: 3,
        },
        hourly: {
          time: ['2026-08-20T15:00'],
          temperature_2m: [28],
          weather_code: [3],
        },
        daily: { precipitation_probability_max: [null] },
      })
    );
    const reading = await fetchWeather();
    expect(reading?.rainChance).toBeNull();
    expect(reading?.temperatureC).toBe(29);
  });
});

describe('🔴 timestamps are instants, not naive local strings', () => {
  /*
   * The bug this pins shipped to production and every local check passed.
   *
   * With `timezone=Asia/Manila` the upstream returns `"2026-08-21T00:30"` —
   * already Manila local, carrying nothing that says so. ECMAScript parses a
   * date-time form WITHOUT an offset as the RUNTIME's local time, so the same
   * string meant two different instants:
   *
   *   machine set to Asia/Manila → 00:30 PHT → rendered 12:30 AM  (correct)
   *   server running UTC         → 00:30 UTC → rendered  8:30 AM  (eight hours out)
   *
   * The reading was current throughout; only the clock beside it was wrong, by
   * exactly the offset. Reported from the live site, not caught here — the
   * developer machine is in the Philippines, so the defect was invisible.
   *
   * These assertions are runtime-timezone INDEPENDENT on purpose: they compare
   * absolute instants, so they fail on any machine if the offset is dropped
   * again. `vitest.config.ts` additionally pins the suite to UTC.
   */
  const ok = (body: unknown) =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => body });

  const payload = {
    utc_offset_seconds: 28800,
    current: {
      time: '2026-08-21T00:30',
      temperature_2m: 25,
      relative_humidity_2m: 90,
      wind_speed_10m: 6,
      weather_code: 3,
    },
    hourly: {
      time: ['2026-08-21T01:00', '2026-08-21T02:00'],
      temperature_2m: [25, 24],
      weather_code: [2, 3],
    },
    daily: { precipitation_probability_max: [67] },
  };

  it('carries the offset on the reading, so it means one thing everywhere', async () => {
    vi.stubGlobal('fetch', ok(payload));
    const reading = await fetchWeather();

    expect(reading?.observedAt).toBe('2026-08-21T00:30+08:00');
    // 00:30 in Manila IS 16:30 UTC the previous day. This is the assertion that
    // goes red the moment the offset is dropped, whatever machine runs it.
    expect(new Date(reading!.observedAt).toISOString()).toBe(
      '2026-08-20T16:30:00.000Z'
    );
  });

  it('carries it on every outlook hour too', async () => {
    vi.stubGlobal('fetch', ok(payload));
    const reading = await fetchWeather();

    expect(reading?.outlook.map(hour => hour.at)).toEqual([
      '2026-08-21T01:00+08:00',
      '2026-08-21T02:00+08:00',
    ]);
    expect(new Date(reading!.outlook[0].at).toISOString()).toBe(
      '2026-08-20T17:00:00.000Z'
    );
  });

  it('renders the reading as Manila time from a UTC runtime', async () => {
    /*
     * The end of the chain, and the thing a resident actually saw. Formatting
     * the stored value into Asia/Manila must give back the wall clock the
     * upstream reported — 12:30 AM — not 8:30 AM.
     */
    vi.stubGlobal('fetch', ok(payload));
    const reading = await fetchWeather();

    const rendered = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(reading!.observedAt));

    expect(rendered).toBe('12:30 AM');
  });

  it('handles a negative offset without inverting the sign', async () => {
    // Nothing in Tago needs this. The helper is general, and a sign flip is the
    // classic way an offset formatter goes wrong unnoticed.
    vi.stubGlobal(
      'fetch',
      ok({
        ...payload,
        utc_offset_seconds: -18000,
        current: { ...payload.current, time: '2026-08-20T12:00' },
      })
    );
    const reading = await fetchWeather();
    expect(reading?.observedAt).toBe('2026-08-20T12:00-05:00');
    expect(new Date(reading!.observedAt).toISOString()).toBe(
      '2026-08-20T17:00:00.000Z'
    );
  });
});
