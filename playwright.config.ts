import { defineConfig, devices } from '@playwright/test'

/**
 * Los tests end-to-end viven en `e2e/`. Los unitarios viven en `tests/` y los
 * corre el runner de Node (`npm test`) — sin este `testDir` acotado, Playwright
 * barría `tests/**` con su patrón por defecto e intentaría ejecutarlos como
 * suyos, que es exactamente lo que rompía `npm test`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
