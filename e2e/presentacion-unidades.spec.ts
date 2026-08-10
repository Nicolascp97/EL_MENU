import { test, expect } from '@playwright/test'

/**
 * La regresión que este test cuida: la tarjeta mostraba "/ gr" sin decir nunca
 * cuántos gramos lleva el cliente, porque `unit_qty` no se leía en ninguna
 * vista. Ver src/lib/units.ts.
 *
 * A propósito NO se afirman precios exactos: el dueño los edita desde el panel
 * y un test amarrado a "$3.380" se caería sin que nada esté roto. Lo que se
 * afirma es que la cantidad y la equivalencia por kilo estén presentes.
 */
test('la tarjeta de un producto por peso declara la cantidad y el precio por kilo', async ({ page }) => {
  await page.goto('/catalogo')

  const card = page.getByRole('article').filter({ hasText: /almendra/i }).first()
  await expect(card).toBeVisible()

  // "250 gr", no "gr" pelado.
  await expect(card).toHaveText(/\d+\s*gr\b/)
  // La equivalencia que permite comparar el formato chico con el grande.
  await expect(card).toHaveText(/\$[\d.]+\s+el kilo/)
})

test('un producto que se vende por kilo entero no repite el precio por kilo', async ({ page }) => {
  await page.goto('/catalogo')

  const card = page.getByRole('article').filter({ hasText: /^\s*Cebolla Morada 1kg/i }).first()
  await expect(card).toBeVisible()
  await expect(card).toHaveText(/1 kg/)
  // Sería redundante: el precio mostrado ya ES el precio del kilo.
  await expect(card).not.toHaveText(/el kilo/)
})
