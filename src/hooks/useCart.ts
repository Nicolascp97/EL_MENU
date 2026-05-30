'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types/database'

type CartItem = {
  product: Product
  qty: number
}

type CartStore = {
  items: CartItem[]
  isOpen: boolean
  cartMode: 'minorista' | 'mayorista'
  addItem: (product: Product, wholesaleMode?: boolean) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clearCart: () => void
  toggleCart: () => void
  total: () => number
  itemPrice: (product: Product) => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      cartMode: 'minorista',

      addItem: (product, wholesaleMode = false) => {
        // Siempre actualizar el modo según el catálogo desde el que se agrega.
        // Si el usuario cambia de catálogo, el modo se actualiza al último item agregado.
        set({ cartMode: wholesaleMode ? 'mayorista' : 'minorista' })
        const items = get().items
        const existing = items.find(i => i.product.id === product.id)
        if (existing) {
          set({ items: items.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i) })
        } else {
          set({ items: [...items, { product, qty: 1 }] })
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(i => i.product.id !== productId) })
      },

      updateQty: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId)
          return
        }
        set({ items: get().items.map(i => i.product.id === productId ? { ...i, qty } : i) })
      },

      clearCart: () => set({ items: [], cartMode: 'minorista' }),

      toggleCart: () => set({ isOpen: !get().isOpen }),

      // Precio efectivo de un producto según el modo del carrito
      itemPrice: (product) => {
        const isWholesale = get().cartMode === 'mayorista' && product.price_wholesale != null
        return isWholesale ? product.price_wholesale! : product.price
      },

      total: () =>
        get().items.reduce((sum, i) => sum + get().itemPrice(i.product) * i.qty, 0),
    }),
    { name: 'elmenu-cart' }
  )
)
