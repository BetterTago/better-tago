import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

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
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
