'use client'
import { X, Minus, Plus, ShoppingBag, Trash2, CreditCard } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'

export default function CartDrawer() {
  const { items, isOpen, toggleCart, updateQty, removeItem, clearCart, total } = useCart()

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={toggleCart}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-lg flex items-center gap-2" style={{ color: 'var(--green-dark)' }}>
            <ShoppingBag size={20} />
            Mi pedido
          </h2>
          <button onClick={toggleCart} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <span className="text-5xl">🛒</span>
              <p className="text-gray-500 text-sm">Tu carrito está vacío</p>
              <button
                onClick={toggleCart}
                className="text-sm font-medium px-4 py-2 rounded-full"
                style={{ backgroundColor: 'var(--green-pale)', color: 'var(--green-dark)' }}
              >
                Ver productos
              </button>
            </div>
          ) : (
            items.map(({ product, qty }) => (
              <div key={product.id} className="flex gap-3 items-center">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                  <Image
                    src={product.images?.[0] || '/placeholders/default.svg'}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{formatPrice(product.price)} / {product.unit}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => updateQty(product.id, qty - 1)}
                      className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-medium w-4 text-center">{qty}</span>
                    <button
                      onClick={() => updateQty(product.id, qty + 1)}
                      className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--green-dark)' }}>
                    {formatPrice(product.price * qty)}
                  </p>
                  <button onClick={() => removeItem(product.id)} className="mt-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{formatPrice(total())}</span>
            </div>
            <p className="text-xs text-gray-400">+ despacho según tu comuna en checkout</p>

            <Link
              href="/checkout"
              onClick={toggleCart}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-full font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#1B2B1E' }}
            >
              <CreditCard size={16} />
              Pagar con Transbank
            </Link>

            <button
              onClick={clearCart}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
