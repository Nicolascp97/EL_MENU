import { chromium } from '@playwright/test'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Pre-warms Turbopack before any test runs.
 * On cold start, the first page load can take >30s while Turbopack compiles
 * all JS bundles on demand. This setup loads the page once so the cache is
 * hot for the actual tests.
 */
export default async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  console.log('\n[global-setup] Pre-calentando servidor en', BASE_URL, '...')
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 120_000 })
    console.log('[global-setup] Home lista ✓ — pre-calentando /checkout...')
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle', timeout: 60_000 })
    console.log('[global-setup] Checkout listo ✓')
  } catch {
    console.warn('[global-setup] Advertencia: el servidor tardó demasiado en responder')
  } finally {
    await browser.close()
  }
}
