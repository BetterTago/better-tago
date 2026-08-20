import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Cache Components: nothing is cached implicitly. Opt in per function with
  // the 'use cache' directive plus cacheLife/cacheTag.
  cacheComponents: true,

  /**
   * Named cache profiles, so a lifetime is reviewable in one place rather than
   * inlined at a call site nobody re-reads.
   *
   * Only ONE is declared, and it is the only thing in this repository that
   * reads a live upstream. Everything else is files on disk and uses the
   * built-in `'max'` — see `src/lib/content.ts`.
   */
  cacheLife: {
    /**
     * `src/lib/weather.ts`. Three numbers, each load-bearing:
     *
     * · `stale` — how long a client may reuse a value without re-asking.
     * · `revalidate` — after 15 minutes the next request triggers a refresh in
     *   the background and is still served the cached reading. That fixes the
     *   upstream call rate at ~96/day regardless of how many people visit,
     *   which is what decouples a third party's rate limit from readership.
     * · `expire` — 🔴 the honest one. Past an hour the value is not served at
     *   all and the widget renders its unavailable line. Without this a dead
     *   upstream leaves a stale temperature on the page looking current, which
     *   on a civic portal is publishing a number that is no longer true.
     */
    weather: {
      stale: 900,
      revalidate: 900,
      expire: 3600,
    },
  },
};

export default withNextIntl(nextConfig);
