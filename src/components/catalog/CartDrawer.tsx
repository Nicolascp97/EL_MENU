'use client'
import { X, Minus, Plus, ShoppingBag, Trash2, CreditCard } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'

export default function CartDrawer() {
  const { items, isOpen, toggleCart, updateQty, removeItem, clearCart, total } = useCart()

  const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || '56954952395'

  function buildWhatsAppMessage() {
    if (items.length === 0) return ''
    const lines = items.map(i => `• ${i.product.name} × ${i.qty} ${i.product.unit} — ${formatPrice(i.product.price * i.qty)}`)
    const summary = [
      'Hola El Menú! Quiero hacer el siguiente pedido:',
      '',
      ...lines,
      '',
      `*Total: ${formatPrice(total())}*`,
      '',
      '¿Hacen despacho a mi dirección?',
    ].join('\n')
    return encodeURIComponent(summary)
  }

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
              Pagar con tarjeta
            </Link>

            <a
              href={`https://wa.me/${WA_NUMBER}?text=${buildWhatsAppMessage()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-full font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#25D366' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Pedir por WhatsApp
            </a>

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
