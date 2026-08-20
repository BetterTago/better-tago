import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { lguConfig } from '@/lib/lgu-config';

/**
 * The portal's FIRST external call, and the pattern every later one copies.
 *
 * Nothing else in this repository has ever left the machine: `content/` is
 * files, `config/` is a file, and until `TAGO-115` there was no `fetch` in
 * `src/` at all. That is why this module is written as a pattern rather than as
 * one widget's data loader — see `docs/coding-standards.md` § *Calling
 * something outside this repository*, which was written from this file.
 *
 * The four rules it exists to demonstrate:
 *
 *   1. **Time-boxed.** `AbortSignal.timeout` on every request. An upstream that
 *      never answers must not hold a render open.
 *   2. **Validated at the boundary.** The response is `unknown` until Zod says
 *      otherwise. A 200 with a body shaped differently is a failure, not data.
 *   3. **Returns `null`, never throws.** Every caller renders an empty state.
 *      A third-party outage is not a page outage.
 *   4. **Cached with a declared lifetime**, so the number of upstream calls is
 *      a function of the clock rather than of how many people are reading.
 */

/** Open-Meteo's documented current-conditions shape, narrowed to what renders. */
const responseSchema = z.object({
  /**
   * 🔴 Required, and it is what makes every timestamp below unambiguous.
   *
   * With `timezone=Asia/Manila` the upstream returns times like
   * `"2026-08-21T00:30"` — already Manila local, and with NO zone designator.
   * JavaScript parses a bare date-time as the RUNTIME's local time, so the same
   * string became 00:30 Manila on a developer machine and 00:30 UTC on the
   * server. See `qualify` below.
   */
  utc_offset_seconds: z.number().int(),
  current: z.object({
    time: z.string().min(1),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    weather_code: z.number().int(),
  }),
  /**
   * The next few hours. `time` and the two series are parallel arrays — the
   * upstream's shape, not a choice — so they are zipped in one place here
   * rather than indexed separately at a call site where they could drift.
   */
  hourly: z.object({
    time: z.array(z.string().min(1)).min(1),
    temperature_2m: z.array(z.number()).min(1),
    weather_code: z.array(z.number().int()).min(1),
  }),
  daily: z.object({
    precipitation_probability_max: z.array(z.number().nullable()).min(1),
  }),
});

/**
 * A naive upstream timestamp turned into a real instant.
 *
 * 🔴 This function exists because its absence shipped a visibly wrong time to
 * production, and every local check passed.
 *
 * The upstream returns `"2026-08-21T00:30"` with `timezone=Asia/Manila` — the
 * value is already Manila local, but carries nothing to say so. Per the
 * ECMAScript spec a date-time form WITHOUT an offset is parsed as the
 * runtime's local time, so:
 *
 * · on a machine set to `Asia/Manila`, `new Date("...T00:30")` is 00:30 PHT and
 *   rendering it in `Asia/Manila` gives **12:30 AM** — correct;
 * · on the server, which runs UTC, the same string is 00:30 **UTC**, and
 *   rendering it in `Asia/Manila` adds eight hours and gives **8:30 AM**.
 *
 * The reading was current the whole time; only the clock beside it was wrong,
 * by exactly the offset. Appending `+08:00` from the payload's own
 * `utc_offset_seconds` makes the string an instant that means the same thing on
 * any runtime, which is what should have been done at the boundary in the first
 * place.
 *
 * ⚠️ Do not "simplify" this back to `new Date(upstreamString)`. It will look
 * right on a machine in the Philippines and be eight hours out in production.
 */
function qualify(naive: string, offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? '-' : '+';
  const total = Math.abs(offsetSeconds);
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  return `${naive}${sign}${hours}:${minutes}`;
}

/** One cell of the short outlook. */
export type HourlyReading = {
  /** A fully-qualified instant, offset included. Never the naive upstream form. */
  at: string;
  temperatureC: number;
  weatherCode: number;
};

/** How many hours the card shows. */
const OUTLOOK_HOURS = 3;

export type WeatherReading = {
  /** Whole degrees Celsius. Rounded here so no component has to decide. */
  temperatureC: number;
  /** A WMO code. `weather-codes.ts` turns it into a translation key. */
  weatherCode: number;
  /** Relative humidity, whole percent. */
  humidity: number;
  /**
   * Wind speed, whole km/h.
   *
   * 🔴 Rendered as a bare number and a unit, and **never styled by magnitude**
   * — no threshold, no colour, no emphasis above some value. See
   * `ConditionsCard.tsx`: the moment a number changes appearance as it rises,
   * this widget is issuing a warning it has no authority to issue.
   */
  windKph: number;
  /** Percent, 0–100, for today. `null` when the upstream omits it. */
  rainChance: number | null;
  /** The next couple of hours. Empty when the upstream gave nothing usable. */
  outlook: HourlyReading[];
  /**
   * A fully-qualified instant, offset included — e.g. `2026-08-21T00:30+08:00`.
   *
   * NOT the naive string the upstream sends. See `qualify`: without the offset
   * this renders eight hours out on any runtime that is not already Philippine
   * time, which is every server this will ever run on.
   */
  observedAt: string;
};

/**
 * 8 seconds, and the number matters — **2.5 seconds was wrong and broke this
 * feature silently.**
 *
 * 🔴 What happened: at 2,500 ms the strip never once showed a reading. It
 * failed closed to its unavailable line on every render, in dev and in a
 * production build, while the upstream was perfectly healthy — a `curl` to the
 * same URL answered 200 in 1.4 s throughout. The gap is connection setup:
 * `curl` and a browser reuse pooled connections, a cold Node `fetch` pays DNS
 * plus a TLS handshake first.
 *
 * Measured on 2026-08-20 rather than guessed again — five consecutive calls:
 *
 * | call | elapsed |
 * | ---- | ------- |
 * | 1 (cold) | 1,614 ms |
 * | 2 | 405 ms |
 * | 3 | 247 ms |
 * | 4 | 244 ms |
 * | 5 | 415 ms |
 *
 * The cold call is 4–6× the warm ones and is not stable: an identical run
 * minutes earlier exceeded 2,500 ms outright. A bound sitting on top of that
 * distribution is not a timeout, it is a coin toss — and this one landed on
 * "broken" so consistently that the feature looked designed to be empty.
 *
 * **8 s costs a reader nothing**, which is the part worth understanding before
 * anyone tightens it again: this never runs in a page load. The route is
 * prerendered, so it runs at build time or in a background revalidation, and
 * the reader is served HTML that already exists either way. The only thing a
 * shorter bound buys is a slightly faster build; the thing it costs is the
 * entire feature, silently.
 *
 * It is still a hard bound, so a hung upstream cannot stall a build for ever.
 */
export const TIMEOUT_MS = 8000;

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/**
 * The current conditions for the configured coordinates, or `null`.
 *
 * 🔴 **`null` is a normal return, not an error path.** It means: no coordinates
 * configured, the upstream did not answer in time, it answered with something
 * this module does not recognise, or it answered with an error. The caller
 * renders a stated-unavailable line and the page is otherwise unaffected.
 *
 * ⚠️ **Do not add a `throw` here, and do not let one escape.** The `catch` is
 * deliberately bare: a `TypeError` from a DNS failure, a `DOMException` from
 * the abort, and a `ZodError` from a bad payload are the same event as far as
 * this page is concerned — there is nothing to show.
 */
/**
 * The call itself, with **no `'use cache'` on it** — and that split is the
 * whole reason this function is exported.
 *
 * `'use cache'` only resolves inside the Next runtime, so a function carrying
 * it cannot be unit-tested at all; `src/lib/content.ts` hits the same wall and
 * answers it the same way, by keeping its framework-free half in a separate
 * module. Here the halves are small enough to share a file.
 *
 * 🔴 It matters more than tidiness. The resilience contract — *returns `null`,
 * never throws* — was originally going to be proven end-to-end by aborting the
 * upstream with `page.route()`. That does not work and the failure is silent:
 * this fetch runs on the SERVER, Playwright only intercepts the BROWSER, so
 * those tests quietly exercised the real Open-Meteo and passed or failed on
 * whether it happened to be up. The proof has to live where the code runs.
 */
export async function fetchWeather(): Promise<WeatherReading | null> {
  const coordinates = lguConfig.lgu.coordinates;
  /*
   * Not a failure — a gap. The municipality's coordinates were `null` in the
   * configuration until 2026-08-20, and could be again if the value is ever
   * withdrawn. The component renders NOTHING in that case rather than an
   * unavailable line, because "we have not obtained a coordinate" is a
   * different statement from "the upstream did not answer", and the gap
   * register already makes the first one on `/gaps`.
   */
  if (!coordinates) return null;

  const url = new URL(ENDPOINT);
  url.searchParams.set('latitude', String(coordinates.latitude));
  url.searchParams.set('longitude', String(coordinates.longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
  );
  url.searchParams.set('hourly', 'temperature_2m,weather_code');
  url.searchParams.set('daily', 'precipitation_probability_max');
  // The portal's own zone, declared once in `src/i18n/request.ts`. Asking the
  // upstream for it means `daily` covers the local day rather than a UTC one,
  // which for a UTC+8 municipality is a different day for eight hours of it.
  url.searchParams.set('timezone', 'Asia/Manila');
  /*
   * 🔴 TWO days, not one, and the reason is the clock rather than the forecast.
   *
   * `hourly` is returned from midnight of the first day only. Asked for one
   * day, a reading taken at 22:30 has exactly one future hour left in the
   * series and the outlook renders a single lonely cell; at 23:30 it renders
   * none at all. The card would quietly empty out every evening.
   *
   * `daily` is still read at index 0, so today's rain probability is unchanged.
   */
  url.searchParams.set('forecast_days', '2');

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return null;

    const { current, hourly, daily } = parsed.data;
    const offset = parsed.data.utc_offset_seconds;
    return {
      temperatureC: Math.round(current.temperature_2m),
      weatherCode: current.weather_code,
      humidity: Math.round(current.relative_humidity_2m),
      windKph: Math.round(current.wind_speed_10m),
      rainChance: daily.precipitation_probability_max[0] ?? null,
      outlook: nextHours(current.time, hourly, offset),
      observedAt: qualify(current.time, offset),
    };
  } catch {
    /*
     * Intentionally empty, and intentionally not logged. `console.log` is
     * forbidden in committed code, and there is no observability surface here
     * to log to — the honest signal that this is failing is the unavailable
     * line the reader can see.
     */
    return null;
  }
}

/**
 * The next `OUTLOOK_HOURS` entries strictly AFTER the current reading.
 *
 * The upstream returns the whole day from midnight, so the first entries are
 * usually in the past — showing them would put "10 AM · 26°" beside a 10 PM
 * reading, which reads as a broken widget rather than as history. Filtering by
 * the current reading's own timestamp is what keeps the two agreeing.
 *
 * Returns `[]` rather than throwing when the series are short or ragged: a
 * missing outlook costs two small cells, and the temperature beside them is
 * still true.
 */
function nextHours(
  now: string,
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] },
  offsetSeconds: number
): HourlyReading[] {
  const readings: HourlyReading[] = [];

  for (let index = 0; index < hourly.time.length; index += 1) {
    const at = hourly.time[index];
    const temperature = hourly.temperature_2m[index];
    const code = hourly.weather_code[index];
    // Parallel arrays can be ragged. A hole is skipped, not rendered as NaN.
    if (at === undefined || temperature === undefined || code === undefined)
      continue;
    // String comparison is correct here: both are the same ISO local format,
    // which sorts lexicographically. No Date parsing, no timezone to get wrong.
    if (at <= now) continue;

    readings.push({
      // Qualified here, AFTER the comparison above — that comparison needs both
      // sides in the same naive form, and the stored value needs an offset so
      // no consumer has to know which runtime it is being parsed on.
      at: qualify(at, offsetSeconds),
      temperatureC: Math.round(temperature),
      weatherCode: code,
    });
    if (readings.length === OUTLOOK_HOURS) break;
  }

  return readings;
}

/**
 * The cached reading. This is what components call.
 *
 * A thin wrapper by design: everything that can fail is in `fetchWeather`,
 * where a test can reach it, and everything the framework owns is here.
 */
export async function getWeather(): Promise<WeatherReading | null> {
  'use cache';
  /*
   * Declared in `next.config.ts` rather than inline, so the three numbers are
   * reviewable in one place beside the other cache profiles. `content.ts` uses
   * `'max'` because files change on deploy; this cannot.
   */
  cacheLife('weather');
  cacheTag('weather');

  return fetchWeather();
}
