import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * The port `next dev` is told to use, taken FROM the URL the tests wait on.
 *
 * These used to be decided independently: the command was a bare `npm run dev`
 * and the url was `BASE_URL`. When port 3000 was already taken — by anything,
 * including an unrelated project — `next dev` quietly moved to the next free
 * port and Playwright went on waiting for 3000 until it timed out two minutes
 * later, reporting a webServer failure and nothing about the actual cause.
 *
 * Derived rather than duplicated, so the server that starts and the URL under
 * test cannot disagree.
 */
const PORT = new URL(BASE_URL).port || '3000';

export default defineConfig({
  testDir: './e2e',
  // 60s, not the 30s default. `webServer` runs `next dev`, which compiles each
  // route the first time it is requested — a cold `/fil` behind three other
  // workers can exceed 30s on the navigation alone.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Capped deliberately: every worker shares ONE Next dev server, and past
  // roughly four the server saturates compiling routes on demand.
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    /*
     * ⚠️ Locally this reuses whatever is already answering on that port, and it
     * does NOT check what that is. Two ways it bites, both worth knowing:
     *
     *  - a DIFFERENT application on the port — the suite runs against it and
     *    fails in ways that have nothing to do with this repository;
     *  - a STALE `next dev` from an earlier session — the suite passes, against
     *    code that is no longer what you just wrote. That one is the dangerous
     *    half, because it is green.
     *
     * If a run looks inexplicable, kill the dev server and run it again, or set
     * PLAYWRIGHT_BASE_URL to a port nothing else is using.
     */
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
