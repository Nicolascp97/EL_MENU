/**
 * Test 05 — Registro de cuenta mayorista
 *
 * Flujo:
 * 1. Ir a /mayorista/registro
 * 2. Completar el formulario con datos de prueba
 * 3. Enviar
 * 4. Verificar pantalla de confirmación de email
 * 5. Verificar que el usuario fue creado en Supabase Auth con metadata correcta
 * 6. Cleanup: eliminar el usuario de prueba
 *
 * Nota: Supabase Confirma el email por defecto. El test verifica que
 * el usuario se crea y se muestra la pantalla "Revisa tu correo".
 */
import { test, expect } from '@playwright/test'
import { getAuthUserById, getAuthUserByEmail, deleteAuthUserById, deleteAuthUserByEmail } from './helpers/db'

test.describe('05 · Registro de cuenta mayorista', () => {

  test('registro completo y verificación en Supabase Auth', async ({ page }) => {
    // Usar timestamp para email único en cada ejecución
    const testEmail = `test.mayorista.${Date.now()}@playwright.elmenu.cl`
    const testPassword = 'PlaywrightTest123!'
    const testName = 'Restaurante QA SpA'
    const testPhone = '+56 9 8000 0001'

    console.log('[Mayorista Test] Email de prueba:', testEmail)

    // ── 1. Navegar al registro ───────────────────────────────────────────────
    await page.goto('/mayorista/registro')
    await page.waitForLoadState('networkidle')

    // Verificar que la página cargó
    await expect(page.getByText('Crear cuenta mayorista')).toBeVisible({ timeout: 8_000 })

    // ── 2. Llenar el formulario ──────────────────────────────────────────────
    await page.locator('#name').fill(testName)
    await page.locator('#phone').fill(testPhone)
    await page.locator('#email').fill(testEmail)
    await page.locator('#password').fill(testPassword)

    // Verificar que los campos tienen los valores correctos
    await expect(page.locator('#name')).toHaveValue(testName)
    await expect(page.locator('#email')).toHaveValue(testEmail)

    // ── 3. Enviar el formulario ──────────────────────────────────────────────
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toContainText('Crear cuenta')

    // Interceptar TODAS las respuestas a /auth/v1/signup para diagnóstico
    let signupUserId: string | null = null
    let signupError: string | null = null
    page.on('response', async (response) => {
      if (response.url().includes('/auth/v1/signup')) {
        try {
          const body = await response.json()
          const errorMsg = body.error_description ?? body.error ?? body.msg ?? body.message ?? null
          console.log('[Mayorista Test] Signup HTTP', response.status(),
            '| userId:', body.user?.id ?? 'none',
            '| error:', errorMsg ?? 'none')
          if (response.status() === 200 && body.user?.id) {
            signupUserId = body.user.id
          } else if (errorMsg) {
            signupError = String(errorMsg)
          }
        } catch {
          console.log('[Mayorista Test] Signup HTTP', response.status(), '— cannot parse body')
        }
      }
    })

    await submitBtn.click()

    // ── 4. Verificar resultado ───────────────────────────────────────────────
    // Esperar a que el signup termine: redirect a /mayorista | "Revisa tu correo" | error en form
    // NOTA: NO usar h1:has-text("Mayorista") porque "Crear cuenta mayorista" siempre lo contiene
    const emailConfirmScreen = page.getByText('Revisa tu correo')
    const formError = page.locator('[class*="red"], [class*="bg-red"]').filter({ hasText: /./i })

    // Poll up to 15s for any of the three outcomes
    let signupOutcome: 'redirect' | 'confirm' | 'error' | 'timeout' = 'timeout'
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const currentUrl = page.url()
      if (new URL(currentUrl).pathname === '/mayorista') {
        signupOutcome = 'redirect'; break
      }
      if (await emailConfirmScreen.isVisible({ timeout: 200 }).catch(() => false)) {
        signupOutcome = 'confirm'; break
      }
      if (await formError.isVisible({ timeout: 200 }).catch(() => false)) {
        signupOutcome = 'error'; break
      }
      await page.waitForTimeout(300)
    }
    console.log('[Mayorista Test] Signup outcome:', signupOutcome, '| signupError:', signupError ?? 'none')

    if (signupOutcome === 'redirect') {
      console.log('[Mayorista Test] ✅ Redirigido al dashboard de mayorista (sin confirmación de email)')
    } else if (signupOutcome === 'confirm') {
      await expect(page.getByText(testEmail)).toBeVisible()
      await expect(page.getByText('confirmar tu cuenta')).toBeVisible()
      console.log('[Mayorista Test] ✅ Pantalla de confirmación de email mostrada correctamente')
    } else {
      const visibleError = await formError.first().textContent().catch(() => 'unknown')
      const rawError = signupError ?? visibleError
      // Si es rate limit de Supabase, omitir el test en vez de fallar
      if (rawError && /rate.?limit|too.?many/i.test(rawError)) {
        test.skip(true, `Supabase rate limit alcanzado: ${rawError}`)
        return
      }
      throw new Error(`Signup falló (${signupOutcome}). URL: ${page.url()}. Error: ${rawError}`)
    }

    // ── 5. Verificar en Supabase Auth ────────────────────────────────────────
    // Dar tiempo a GoTrue para persistir el usuario
    await page.waitForTimeout(2_000)

    // Usar el ID capturado del signup (más confiable que buscar por email en listUsers)
    let createdUser = signupUserId ? await getAuthUserById(signupUserId) : undefined
    if (!createdUser) {
      // Fallback: buscar por email (puede fallar si hay problemas de paginación)
      createdUser = await getAuthUserByEmail(testEmail)
    }

    expect(createdUser, `El usuario ${testEmail} debe existir en Supabase Auth (signupId=${signupUserId})`).toBeTruthy()

    if (createdUser) {
      // Verificar metadata
      expect(createdUser.user_metadata?.name, 'El nombre debe coincidir').toBe(testName)
      expect(createdUser.user_metadata?.phone, 'El teléfono debe coincidir').toBe(testPhone)
      expect(createdUser.user_metadata?.mayorista_requested, 'mayorista_requested debe ser true').toBe(true)
      expect(createdUser.user_metadata?.role, 'role inicial debe ser minorista').toBe('minorista')

      console.log(`[Mayorista Test] ✅ Usuario creado en Auth:`)
      console.log(`  - ID: ${createdUser.id}`)
      console.log(`  - Email: ${createdUser.email}`)
      console.log(`  - Name: ${createdUser.user_metadata?.name}`)
      console.log(`  - mayorista_requested: ${createdUser.user_metadata?.mayorista_requested}`)
    }

    // ── 6. Cleanup: eliminar usuario de prueba ───────────────────────────────
    if (createdUser?.id) {
      await deleteAuthUserById(createdUser.id)
    } else {
      await deleteAuthUserByEmail(testEmail)
    }
    console.log('[Mayorista Test] 🧹 Usuario de prueba eliminado:', testEmail)
  })

  test('validación: formulario rechaza email ya registrado', async ({ page }) => {
    // Primero crear un usuario de prueba
    const startTime = new Date()
    const testEmail = `test.duplicado.${Date.now()}@playwright.elmenu.cl`

    // Intentar registrar con email nuevo
    await page.goto('/mayorista/registro')
    await page.waitForLoadState('networkidle')

    await page.locator('#name').fill('Empresa Duplicada')
    await page.locator('#phone').fill('+56 9 0000 0001')
    await page.locator('#email').fill(testEmail)
    await page.locator('#password').fill('PlaywrightTest123!')
    await page.locator('button[type="submit"]').click()

    // Esperar a que se cree el usuario
    await expect(
      page.getByText('Revisa tu correo').or(page.locator('h1:has-text("Mayorista")'))
    ).toBeVisible({ timeout: 15_000 })

    // Intentar registrar con el mismo email
    await page.goto('/mayorista/registro')
    await page.waitForLoadState('networkidle')

    await page.locator('#name').fill('Empresa Duplicada 2')
    await page.locator('#phone').fill('+56 9 0000 0002')
    await page.locator('#email').fill(testEmail) // Mismo email
    await page.locator('#password').fill('OtroPassword456!')
    await page.locator('button[type="submit"]').click()

    // Debe mostrar error de email ya registrado
    const errorMsg = page.locator('[class*="red"], [class*="error"]').filter({ hasText: /correo|cuenta|email|ya hay/i })
    await expect(errorMsg).toBeVisible({ timeout: 8_000 })

    console.log('[Duplicado Test] ✅ El formulario rechazó el email duplicado correctamente')

    // Cleanup
    await deleteAuthUserByEmail(testEmail)
  })

  test('validación: formulario rechaza contraseña corta (< 8 chars)', async ({ page }) => {
    await page.goto('/mayorista/registro')
    await page.waitForLoadState('networkidle')

    await page.locator('#name').fill('Test Contraseña Corta')
    await page.locator('#phone').fill('+56 9 1111 1111')
    await page.locator('#email').fill(`corta.${Date.now()}@test.cl`)
    await page.locator('#password').fill('12345') // Solo 5 chars

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // HTML5 minLength=8 debe prevenir el envío
    // O el servidor debe devolver error
    await page.waitForTimeout(1_500)
    await expect(page).not.toHaveURL(/\/mayorista$/) // No debe redirigir
  })

  test('el link "Ir a ingresar" funciona desde la pantalla de confirmación', async ({ page }) => {
    const testEmail = `test.link.${Date.now()}@playwright.elmenu.cl`

    await page.goto('/mayorista/registro')
    await page.waitForLoadState('networkidle')

    await page.locator('#name').fill('Test Link')
    await page.locator('#phone').fill('+56 9 2222 2222')
    await page.locator('#email').fill(testEmail)
    await page.locator('#password').fill('PlaywrightTest123!')
    await page.locator('button[type="submit"]').click()

    const emailScreen = page.getByText('Revisa tu correo')
    if (await emailScreen.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const loginLink = page.locator('a[href*="login"]')
      await expect(loginLink).toBeVisible()
      await loginLink.click()
      await expect(page).toHaveURL(/mayorista\/login/, { timeout: 5_000 })
      console.log('[Link Test] ✅ Link "Ir a ingresar" navega a /mayorista/login')
    }

    // Cleanup
    await deleteAuthUserByEmail(testEmail)
  })
})
