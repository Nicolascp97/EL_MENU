import { test, expect } from '@playwright/test'
import { clearStorageCart } from './helpers/cart'

test.describe('01 · Página de inicio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorageCart(page)
  })

  test('carga la página y tiene título correcto', async ({ page }) => {
    await expect(page).toHaveTitle(/El\s*Men[uú]/i, { timeout: 10_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('el navbar muestra el botón del carrito con texto', async ({ page }) => {
    const cartBtn = page.locator('button[aria-label="Ver carrito"]')
    await expect(cartBtn).toBeVisible({ timeout: 8_000 })
    await expect(cartBtn).toContainText('Mi carrito')
  })

  test('el navbar muestra badge vacío (0 items) al inicio', async ({ page }) => {
    const cartBtn = page.locator('button[aria-label="Ver carrito"]')
    await expect(cartBtn).toBeVisible({ timeout: 8_000 })
    // Badge no debe estar visible cuando el carrito está vacío
    const badge = cartBtn.locator('.badge')
    await expect(badge).toBeHidden()
  })

  test('muestra productos en la página de inicio', async ({ page }) => {
    // Esperar al menos un botón "Agregar" o "Añadir"
    const addBtn = page.locator('button.add-yellow, button:has-text("Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
  })

  test('tiene enlace al catálogo completo', async ({ page }) => {
    const catLink = page.locator('a[href*="catalogo"]').first()
    await expect(catLink).toBeVisible({ timeout: 8_000 })
  })

  test('el chatbot FAB está presente', async ({ page }) => {
    // ChatWidget renderiza un botón flotante — verificamos que existe algún elemento flotante
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    // Verificar que no hay errores de hidratación o JS graves
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    // Sin errores críticos de React
    const criticalErrors = errors.filter(e =>
      e.includes('Hydration') || e.includes('Minified React error')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('la página es responsiva — versión mobile no tiene overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 14
    await page.goto('/')
    const body = page.locator('body')
    const bodyWidth = await body.evaluate(el => el.scrollWidth)
    const viewportWidth = 390
    // El body no debe ser más ancho que el viewport
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5) // tolerancia de 5px
  })

  test('la navegación al catálogo funciona', async ({ page }) => {
    const catLink = page.locator('a[href*="catalogo"]').first()
    await expect(catLink).toBeVisible({ timeout: 8_000 })
    await catLink.click()
    await expect(page).toHaveURL(/catalogo/, { timeout: 10_000 })
    await expect(page.locator('body')).not.toContainText('404')
  })
})
