import { test, expect } from '@playwright/test'
import { clearStorageCart, injectCart, readStorageCart } from './helpers/cart'
import { getActiveProducts } from './helpers/db'

test.describe('02 · Carrito de compras', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorageCart(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('agregar un producto desde la página de inicio cambia el botón', async ({ page }) => {
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    // El botón debe cambiar a "✓ Agregado" por ~1.2s
    await expect(addBtn).toContainText('Agregado', { timeout: 3_000 })
  })

  test('el badge del navbar incrementa al agregar un producto', async ({ page }) => {
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(300)

    const cartBtn = page.locator('button[aria-label="Ver carrito"]')
    const badge = cartBtn.locator('.badge')
    await expect(badge).toBeVisible({ timeout: 3_000 })
    await expect(badge).toContainText('1')
  })

  test('el carrito se abre y muestra el producto agregado', async ({ page }) => {
    // Agregar producto
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    // Abrir carrito
    await page.locator('button[aria-label="Ver carrito"]').click()

    // Drawer visible
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // Al menos un producto listado
    const productName = drawer.locator('p.font-medium').first()
    await expect(productName).toBeVisible({ timeout: 3_000 })
  })

  test('el carrito muestra opciones de entrega y pago', async ({ page }) => {
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    await page.locator('button[aria-label="Ver carrito"]').click()
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // Opciones de entrega
    await expect(drawer.getByText('A domicilio')).toBeVisible()
    await expect(drawer.getByText('Retiro en tienda')).toBeVisible()

    // Opciones de pago
    await expect(drawer.getByText('Transbank')).toBeVisible()
    await expect(drawer.getByText('Transferencia')).toBeVisible()
  })

  test('se puede incrementar la cantidad de un producto en el carrito', async ({ page }) => {
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    await page.locator('button[aria-label="Ver carrito"]').click()
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // Cantidad inicial = 1
    const qtySpan = drawer.locator('span.font-medium.w-4.text-center').first()
    await expect(qtySpan).toHaveText('1', { timeout: 3_000 })

    // Click en "+" (el segundo botón del ítem: 0=minus, 1=plus, 2=trash)
    const itemRow = drawer.locator('div.flex.gap-3.items-center').first()
    const plusBtn = itemRow.locator('button').nth(1)
    await plusBtn.click()
    await expect(qtySpan).toHaveText('2', { timeout: 2_000 })
  })

  test('se puede decrementar la cantidad — al llegar a 0 se elimina el ítem', async ({ page }) => {
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    await page.locator('button[aria-label="Ver carrito"]').click()
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // Eliminar ítem con botón "-" cuando qty=1
    const itemRow = drawer.locator('div.flex.gap-3.items-center').first()
    const minusBtn = itemRow.locator('button').nth(0) // El "-" es el primer botón del ítem
    await minusBtn.click()

    // El carrito debe quedar vacío
    await expect(drawer.getByText('Tu carrito está vacío')).toBeVisible({ timeout: 3_000 })
  })

  test('vaciar carrito muestra el estado vacío', async ({ page }) => {
    test.setTimeout(60_000)
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    await page.locator('button[aria-label="Ver carrito"]').click()
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    await drawer.getByText('Vaciar carrito').click()
    await expect(drawer.getByText('Tu carrito está vacío')).toBeVisible({ timeout: 3_000 })
  })

  test('el botón "Continuar al pago" navega al checkout', async ({ page }) => {
    test.setTimeout(60_000) // Primera visita a /checkout compila Turbopack (~30s)
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    await page.locator('button[aria-label="Ver carrito"]').click()
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    const checkoutLink = drawer.locator('a[href*="/checkout"]')
    await expect(checkoutLink).toBeVisible()
    await expect(checkoutLink).toContainText('Continuar al pago')
    await checkoutLink.click()

    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 })
  })

  test('agregar múltiples productos distintos funciona', async ({ page }) => {
    test.setTimeout(60_000)
    // Usar inyección directa para asegurar múltiples productos
    const products = await getActiveProducts(3)
    if (products.length < 2) {
      test.skip(true, 'No hay suficientes productos activos')
      return
    }

    await injectCart(page, products.slice(0, 2))
    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.locator('button[aria-label="Ver carrito"]').click()
    const drawer = page.getByLabel('Carrito de compras')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // Verificar que aparecen 2 ítems
    const items = drawer.locator('div.flex.gap-3.items-center')
    await expect(items).toHaveCount(2, { timeout: 3_000 })
  })

  test('el carrito persiste entre navegaciones (localStorage)', async ({ page }) => {
    test.setTimeout(60_000)
    const addBtn = page.locator('button.add-yellow, button:has-text("+ Agregar")').first()
    await expect(addBtn).toBeVisible({ timeout: 12_000 })
    await addBtn.click()
    await page.waitForTimeout(400)

    // Navegar a otra página y volver
    await page.goto('/catalogo')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // El badge debe seguir mostrando 1
    const badge = page.locator('button[aria-label="Ver carrito"] .badge')
    await expect(badge).toBeVisible({ timeout: 5_000 })
    await expect(badge).toContainText('1')
  })
})
