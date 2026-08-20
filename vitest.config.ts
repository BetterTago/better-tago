import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    /**
     * 🔴 The suite runs in UTC, like the server — not in whatever zone the
     * machine happens to be in.
     *
     * This is here because its absence let a real defect reach production. The
     * weather upstream returns naive local timestamps, ECMAScript parses those
     * against the RUNTIME's zone, and this project's machines are in the
     * Philippines — so `new Date("2026-08-21T00:30")` was correct locally and
     * eight hours out on a UTC server. Every test passed; the live site showed
     * 8:30 AM at half past midnight.
     *
     * Pinning UTC does not make the tests right on its own — the assertions
     * that pin it compare absolute instants and would fail in any zone. What it
     * does is stop a developer machine's own timezone from quietly agreeing
     * with a bug that production will not.
     *
     * ⚠️ It also means a test asserting a WALL CLOCK must name its timezone
     * explicitly, which is what `src/lib/dates.ts` already requires of the app.
     */
    env: { TZ: 'UTC' },
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // e2e/ belongs to Playwright. scripts/ is plain .mjs so the harvester
    // stays runnable by `node` with no build step — its parser is the
    // riskiest code in the repo and is tested here rather than by hand.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.mjs'],
  },
});
