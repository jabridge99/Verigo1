import { existsSync } from 'fs'
import { defineConfig, devices } from '@playwright/test'

// Some sandboxed dev environments pre-install a Chromium build that
// doesn't exactly match this repo's pinned @playwright/test version and
// have no outbound network access for `playwright install` to fetch a
// matching one -- use it directly when present. CI (and a normal local
// dev machine) has no file at this path, so `playwright install` there
// resolves its own browser as usual.
const sandboxChromium = '/opt/pw-browsers/chromium'
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
})
