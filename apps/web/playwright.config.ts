import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 9100);
const basis = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: basis,
    trace: 'off',
    // In der Entwicklungsumgebung liegt Chromium schon bereit. Wo nicht, greift
    // der von Playwright selbst installierte Browser.
    launchOptions: process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm run standalone:vorbereiten && node .next/standalone/apps/web/server.js',
    env: { PORT: String(port), HOSTNAME: '127.0.0.1' },
    url: `${basis}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
