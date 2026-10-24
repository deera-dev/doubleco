import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/*
 * Claude's cloud sandbox pre-installs Chromium at /opt/pw-browsers —
 * reuse it there instead of downloading a second copy. Anywhere else
 * (local dev, CI) this path won't exist, so Playwright falls back to
 * its own browser install (`npx playwright install chromium`, already
 * wired into the CI workflow).
 */
const sandboxChromium = '/opt/pw-browsers/chromium'
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
  ],
})
