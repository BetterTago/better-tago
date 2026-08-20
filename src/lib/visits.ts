import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';

/**
 * The visit count — reading it, and adding one to it.
 *
 * ## What this counts, precisely
 *
 * **Page loads, deduplicated to at most one per browser per 24 hours.** It is
 * not unique visitors, not sessions, and not pageviews, and no surface may call
 * it any of those three.
 *
 * What it cannot see, stated here because the footer states it too:
 *
 * · every reader with JavaScript off — and this portal is built to work
 *   entirely without it, so those are exactly the readers it most cares about;
 * · anything served from an edge cache without reaching this code;
 * · a repeat visit inside the 24-hour window;
 * · a private-browsing session, which is counted AGAIN each time, because the
 *   marker that would suppress it cannot persist.
 *
 * And what inflates it: crawlers. `robots.ts` allows every user agent and
 * `sitemap.ts` publishes ~380 URLs, which is the portal working as intended.
 * The handler refuses the ones that declare themselves; the ones that do not
 * are indistinguishable from a resident and always will be.
 *
 * 🔴 **So the number is decorative, and the footer says so.** It is deliberately
 * NOT one of the nine measures on `PROG-301`, whose criterion 5 requires every
 * measure be reproducible from the content layer by anyone. This is reproducible
 * by nobody, which is the reason it is excluded from that set rather than added
 * to it.
 *
 * ## 🔒 Nothing personal is stored, and nothing personal is read
 *
 * There is no IP address in this module, no user-agent hash, no fingerprint, no
 * cookie and no identifier of any kind. Deduplication happens in the reader's
 * own browser (`VisitCount.tsx`), against a timestamp only they hold.
 *
 * The companion spec originally specified a salted rotating hash of IP + user
 * agent for server-side dedup. It was dropped: the accuracy it buys is marginal
 * on a figure already labelled as bot-inflated, and the cost it avoids is the
 * entire personal-data apparatus — a privacy policy route, a retention window,
 * a processor to name, and an amendment to `docs/governance.md` § *What we
 * never ask for*, which currently opens "No personal information is collected".
 * That sentence stays true, and it stays true structurally rather than by
 * anyone remembering.
 *
 * The honest cost of that trade: the endpoint is easier to inflate. The handler
 * requires a same-origin request and refuses declared crawlers, and past that
 * the number is what the footer already says it is.
 */

/**
 * Where the count lives.
 *
 * An HTTP-addressed, Redis-compatible key-value store — HTTP rather than TCP
 * because a serverless function cannot hold a connection pool. Reached with
 * `fetch` and no SDK: the two commands used here are one URL each, and a client
 * library would buy typing over that in exchange for a dependency and a version
 * to track.
 *
 * ⚠️ **Both are secret and neither may ever be prefixed `NEXT_PUBLIC_`.** They
 * are absent from `.env.example` as values by design — it carries the names and
 * nothing else.
 */
const STORE_URL = process.env.VISITOR_STORE_URL;
const STORE_TOKEN = process.env.VISITOR_STORE_TOKEN;

/**
 * A stand-in figure, so the footer can be LOOKED AT before a store exists.
 *
 * 🔴 **This publishes a number that is not true, which is the one thing this
 * portal is built never to do.** It exists because the counter's design is
 * unreviewable while it renders nothing, and seeing it is how the layout gets
 * judged. Three things keep it from becoming a lie on a civic page:
 *
 * 1. **A real store always wins.** If `VISITOR_STORE_URL` and
 *    `VISITOR_STORE_TOKEN` are set, this value is never read — so it cannot
 *    override, mask, or "correct" a live count. Asserted by a unit test.
 * 2. **It is opt-in per environment**, set nowhere in the repository. `.env*`
 *    is git-ignored and `.env.example` carries the name with this warning, not
 *    a value. A deployment shows a mock only if somebody typed one into it.
 * 3. **The name says what it is.** Not `VISITOR_COUNT`. Anybody reading a
 *    deployment's configuration sees the word PREVIEW next to the number.
 *
 * ⚠️ **Delete this the day a store is provisioned.** A preview hatch left in
 * after it stops being needed is how a placeholder ends up published.
 */
const PREVIEW_COUNT = process.env.VISITOR_COUNT_PREVIEW;

/** One key. The portal counts one thing. */
const KEY = 'tago:visits:total';

const TIMEOUT_MS = 2000;

/** The store answers `{"result": …}` for every command. */
const storeResponse = z.object({ result: z.unknown() });

/**
 * `true` when a store is configured at all.
 *
 * An unconfigured store is a legitimate state, not a misconfiguration to shout
 * about: it is what every developer machine and every preview build looks like
 * until someone provisions one, and the portal must be completely normal in it.
 */
export function isVisitStoreConfigured(): boolean {
  return Boolean(STORE_URL && STORE_TOKEN);
}

/**
 * One store command.
 *
 * ⚠️ `init` is how the READ and the WRITE differ, and the difference matters.
 * The read runs inside a `'use cache'` scope and lets that scope govern it; the
 * write passes `no-store` explicitly, so no future refactor can quietly cache an
 * increment and stop the counter dead.
 */
async function command(
  path: string[],
  init?: Pick<RequestInit, 'cache'>
): Promise<unknown> {
  if (!STORE_URL || !STORE_TOKEN) return null;

  try {
    const response = await fetch(
      `${STORE_URL.replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}`,
      {
        headers: { authorization: `Bearer ${STORE_TOKEN}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        ...init,
      }
    );
    if (!response.ok) return null;

    const parsed = storeResponse.safeParse(await response.json());
    return parsed.success ? parsed.data.result : null;
  } catch {
    return null;
  }
}

/**
 * The current total, or `null`.
 *
 * 🔴 **`null` is not zero and must never be rendered as zero.** It means the
 * store is unconfigured, cold, or did not answer — three states in which this
 * portal knows nothing, and a portal that publishes `0` visits it has not
 * counted is publishing a number that is not true. The footer renders nothing.
 */
export async function readVisitCount(): Promise<number | null> {
  if (isVisitStoreConfigured()) {
    const result = await command(['get', KEY]);
    if (result === null || result === undefined) return null;

    const count = Number(result);
    return Number.isInteger(count) && count >= 0 ? count : null;
  }

  /*
   * Only reachable with NO store configured — see the note on PREVIEW_COUNT.
   * A real store is read above and returns before this line, so a preview value
   * can never stand in front of, or silently replace, a live count.
   */
  if (PREVIEW_COUNT !== undefined) {
    /*
     * 🔴 The emptiness check is not defensive tidying — it is the whole guard.
     *
     * `Number('')` is `0`, and `0` is an integer ≥ 0, so a bare
     * `VISITOR_COUNT_PREVIEW=` in an env file rendered "0 visits" — the exact
     * figure this module exists to never publish, arrived at by the exact route
     * (a falsy value coerced to a number) that the rest of it guards against.
     * Caught by a test, not in review.
     */
    const raw = PREVIEW_COUNT.trim();
    const preview = raw === '' ? Number.NaN : Number(raw);
    // Anything else malformed is `null` too: a bad preview value renders
    // nothing, exactly like a cold store — the same failure, the same answer.
    if (Number.isInteger(preview) && preview >= 0) return preview;
  }

  return null;
}

/**
 * The cached count. This is what `SiteFooter` calls.
 *
 * 🔴 The `'use cache'` is NOT optional, and its absence broke the deployment
 * build.
 *
 * `SiteFooter` renders inside `src/app/[locale]/layout.tsx`, so this read sits
 * in `<html><body>` on EVERY route. Uncached, that is uncached data outside a
 * `<Suspense>` boundary, which `cacheComponents` refuses to prerender:
 *
 *   Route "/[locale]/charter/documents/[slug]": Uncached data was accessed
 *   outside of <Suspense> … at body … at html
 *
 * `getWeather` in `src/lib/weather.ts` was written this way from the start;
 * this was not, and the inconsistency was invisible on a local build.
 *
 * A thin wrapper for the same reason as `getWeather` — everything that can fail
 * is in `readVisitCount`, where a test can reach it, because `'use cache'` only
 * resolves inside the Next runtime.
 */
export async function getVisitCount(): Promise<number | null> {
  'use cache';
  cacheLife('visits');
  cacheTag('visits');

  return readVisitCount();
}

/**
 * Add one. Best effort, and deliberately unreported.
 *
 * The caller never awaits this on a render path and there is nothing useful to
 * return: a failed increment is a number that is one lower than it should be,
 * which is invisible and harmless. A page that broke because a counter could
 * not count would not be.
 */
export async function recordVisit(): Promise<void> {
  await command(['incr', KEY], { cache: 'no-store' });
}
