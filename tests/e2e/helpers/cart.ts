/**
 * Helpers para manipular el estado del carrito (Zustand + localStorage).
 * Úsalos para pre-cargar el carrito antes de ir al checkout sin pasar por la UI.
 */
import type { Page } from '@playwright/test'
import type { Product } from './db'

export type CartItem = {
  product: {
    id: string
    name: string
    price: number
    unit: string
    images: string[]
  }
  qty: number
}

/** Inyecta productos en el localStorage de Zustand (elmenu-cart). */
export async function injectCart(page: Page, products: Product[], qty = 2) {
  const cartState = {
    state: {
      items: products.map(p => ({
        product: {
          id: p.id,
          name: p.name,
          price: p.price,
          unit: p.unit,
          images: p.images ?? [],
        },
        qty,
      })),
      isOpen: false,
    },
    version: 0,
  }
  await page.evaluate(
    (state) => localStorage.setItem('elmenu-cart', JSON.stringify(state)),
    cartState
  )
}

/** Vacía el carrito en localStorage. */
export async function clearStorageCart(page: Page) {
  await page.evaluate(() => localStorage.removeItem('elmenu-cart'))
}

/** Lee el carrito actual desde localStorage (para verificación). */
export async function readStorageCart(page: Page): Promise<CartItem[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('elmenu-cart')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return parsed?.state?.items ?? []
    } catch {
      return []
    }
  })
}
