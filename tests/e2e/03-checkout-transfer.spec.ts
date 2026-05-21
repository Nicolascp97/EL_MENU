/**
 * Test 03 — Checkout por Transferencia bancaria
 *
 * Flujo completo:
 * 1. Inyectar productos en el carrito
 * 2. Ir al checkout
 * 3. Seleccionar "Retiro en tienda" + "Transferencia"
 * 4. Completar y enviar el formulario
 * 5. Verificar página de confirmación
 * 6. Verificar que el pedido existe en Supabase con los datos correctos
 */
import { test, expect } from '@playwright/test'
import { injectCart, clearStorageCart } from './helpers/cart'
import { getActiveProducts, getFirstZone, getOrderById } from './helpers/db'

/** Calcula la cantidad mínima para superar el mínimo de pedido de la zona. */
function cartQty(products: { price: number; stock: number }[], minOrder: number): number {
  const totalUnitPrice = products.reduce((s, p) => s + p.price, 0)
  if (totalUnitPrice === 0) return 1
  const needed = Math.max(1, Math.ceil(minOrder / totalUnitPrice))
  const maxByStock = products.reduce((m, p) => Math.min(m, p.stock), Infinity)
  return Math.min(needed, maxByStock)
}

test.describe('03 · Checkout — Transferencia bancaria', () => {

  test('flujo completo: pedido por transferencia con retiro en tienda', async ({ page }) => {
    // ── 1. Setup: productos y zona ──────────────────────────────────────────
    const products = await getActiveProducts(3)
    if (!products.length) {
      test.skip(true, 'No hay productos activos en la DB')
      return
    }

    await page.goto('/')
    await clearStorageCart(page)

    // Para retiro en tienda no hay mínimo de zona — usar qty=3
    await injectCart(page, products, 3)

    // ── 2. Ir al checkout preseleccionando tienda + transfer ────────────────
    await page.goto('/checkout?delivery=tienda&payment=transfer')
    await page.waitForLoadState('networkidle')

    // Verificar que el carrito NO está vacío
    await expect(page.locator('body')).not.toContainText('Tu carrito está vacío', { timeout: 8_000 })

    // ── 3. Completar formulario ─────────────────────────────────────────────
    // Nombre
    await page.getByLabel('Nombre').fill('Test Transferencia')
    // Teléfono
    await page.getByLabel('Teléfono').fill('+56 9 1111 2222')

    // Asegurar que "Retiro en tienda" está seleccionado
    const tiendaSection = page.locator('section').filter({ hasText: 'Tipo de entrega' })
    const tiendaBtn = tiendaSection.getByText('Retiro en tienda')
    if (await tiendaBtn.isVisible()) {
      await tiendaBtn.click()
    }

    // Asegurar que "Transferencia" está seleccionado
    const paySection = page.locator('section').filter({ hasText: 'Método de pago' })
    const transferBtn = paySection.getByRole('button', { name: /^Transferencia/ })
    if (await transferBtn.isVisible()) {
      await transferBtn.click()
    }

    // Verificar que aparecen los datos bancarios
    await expect(page.getByText('Datos para la transferencia')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Banco de Chile')).toBeVisible()

    // ── 4. Enviar formulario ────────────────────────────────────────────────
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })

    // El botón debe decir algo como "Confirmar retiro"
    const btnText = await submitBtn.textContent()
    console.log('[Transfer Test] Submit button:', btnText?.trim())

    await submitBtn.click()

    // ── 5. Verificar página de confirmación ─────────────────────────────────
    await expect(page).toHaveURL(/\/checkout\/confirmacion\?.*status=transfer/, { timeout: 20_000 })
    await expect(page.getByText('¡Pedido recibido!')).toBeVisible({ timeout: 5_000 })

    // Verificar instrucciones de transferencia en la página
    await expect(page.getByText('¿Cómo confirmar tu pedido?')).toBeVisible()
    await expect(page.getByText('comprobante').first()).toBeVisible()

    // ── 6. Verificar en Supabase ────────────────────────────────────────────
    const url = new URL(page.url())
    const orderId = url.searchParams.get('orderId')
    console.log('[Transfer Test] Order ID:', orderId)
    expect(orderId, 'La URL debe incluir el orderId').toBeTruthy()

    const order = await getOrderById(orderId!)

    // Estado correcto para transferencia
    expect(order.status, 'status debe ser nuevo').toBe('nuevo')
    expect(order.payment_status, 'payment_status debe ser pendiente').toBe('pendiente')
    expect(order.channel, 'canal debe ser web').toBe('web')

    // Datos del formulario preservados
    expect(order.phone, 'teléfono debe coincidir').toBe('+56 9 1111 2222')
    expect(order.address, 'dirección debe ser Retiro en tienda').toBe('Retiro en tienda')
    expect(order.commune, 'comuna debe ser Retiro en tienda').toBe('Retiro en tienda')

    // Items y total
    expect(order.items.length, 'debe tener ítems').toBeGreaterThan(0)
    expect(order.total, 'total debe ser mayor a 0').toBeGreaterThan(0)

    console.log(`[Transfer Test] ✅ Pedido #${orderId!.slice(0, 8)} creado OK. Total: $${order.total.toLocaleString('es-CL')}`)
  })

  test('flujo completo: pedido por transferencia con despacho a domicilio', async ({ page }) => {
    // ── 1. Setup ────────────────────────────────────────────────────────────
    const products = await getActiveProducts(3)
    const zone = await getFirstZone()

    if (!products.length) {
      test.skip(true, 'No hay productos activos')
      return
    }
    if (!zone || !zone.communes.length) {
      test.skip(true, 'No hay zonas de despacho configuradas')
      return
    }

    const commune = zone.communes[0]

    await page.goto('/')
    await clearStorageCart(page)

    const qty = cartQty(products, zone.min_order)
    await injectCart(page, products, qty)

    // ── 2. Ir al checkout ───────────────────────────────────────────────────
    await page.goto('/checkout?delivery=domicilio&payment=transfer')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Tu carrito está vacío', { timeout: 8_000 })

    // ── 3. Formulario con domicilio ─────────────────────────────────────────
    await page.getByLabel('Nombre').fill('Test Domicilio Transfer')
    await page.getByLabel('Teléfono').fill('+56 9 3333 4444')

    // Seleccionar "Despacho a domicilio"
    const domicilioSection = page.locator('section').filter({ hasText: 'Tipo de entrega' })
    await domicilioSection.getByText('Despacho a domicilio').click()

    // Llenar dirección
    await page.getByLabel(/Calle|dirección|número/i).fill('Av. Las Condes 12345, Depto 5B')

    // Seleccionar la primera comuna disponible
    const communeSelect = page.locator('select')
    await communeSelect.selectOption(commune)

    // Seleccionar transferencia
    const paySection = page.locator('section').filter({ hasText: 'Método de pago' })
    await paySection.getByRole('button', { name: /^Transferencia/ }).click()

    // ── 4. Enviar ───────────────────────────────────────────────────────────
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    // ── 5. Confirmación ─────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/checkout\/confirmacion\?.*status=transfer/, { timeout: 20_000 })
    await expect(page.getByText('¡Pedido recibido!')).toBeVisible()

    // ── 6. DB verification ─────────────────────────────────────────────────
    const url = new URL(page.url())
    const orderId = url.searchParams.get('orderId')
    expect(orderId).toBeTruthy()

    const order = await getOrderById(orderId!)
    expect(order.status).toBe('nuevo')
    expect(order.payment_status).toBe('pendiente')
    expect(order.phone).toBe('+56 9 3333 4444')
    expect(order.commune).toBe(commune)
    expect(order.total).toBeGreaterThan(0)

    console.log(`[Transfer Domicilio] ✅ Pedido #${orderId!.slice(0, 8)} — ${commune} — $${order.total.toLocaleString('es-CL')}`)
  })

  test('validación: el checkout rechaza formulario incompleto', async ({ page }) => {
    const products = await getActiveProducts(1)
    if (!products.length) {
      test.skip(true, 'No hay productos activos')
      return
    }

    await page.goto('/')
    await clearStorageCart(page)
    await injectCart(page, products, 2)
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')

    // No llenar nombre ni teléfono — intentar enviar
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    // HTML5 validation o error de API debe aparecer
    // La URL NO debe cambiar a /confirmacion
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/confirmacion/)
    await expect(page).toHaveURL(/checkout/)
  })
})
