import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  preserveOutput: 'always',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/SA-AKI/',
    locale: 'zh-TW',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: '**/mobile-flow.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1586, height: 992 } } },
    { name: 'mobile-chrome', testIgnore: '**/fidelity.spec.ts', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/SA-AKI/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
