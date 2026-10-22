import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 90_000, expect: { timeout: 12_000 }, fullyParallel: false, workers: 1,
  use: { baseURL: process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:4200', trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout:15_000, navigationTimeout:30_000,
    launchOptions: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] } : {} },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'npm start -- --port 4200', url: 'http://localhost:4200', reuseExistingServer: !process.env['CI'], timeout: 120_000 }
});
