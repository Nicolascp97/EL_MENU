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
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clearCart: () => void
  toggleCart: () => void
  total: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (product) => {
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
      clearCart: () => set({ items: [] }),
      toggleCart: () => set({ isOpen: !get().isOpen }),
      total: () => get().items.reduce((sum, i) => sum + i.product.price * i.qty, 0),
    }),
    { name: 'elmenu-cart' }
  )
)
