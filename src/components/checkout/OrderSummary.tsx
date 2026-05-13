'use client'
import Image from 'next/image'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import type { Zone, UserRole } from '@/types/database'

type Props = {
  zone: Zone | null
  userRole: UserRole
}

export default function OrderSummary({ zone, userRole }: Props) {
  const items = useCart(s => s.items)
  const updateQty = useCart(s => s.updateQty)
  const removeItem = useCart(s => s.removeItem)

  const isWholesale = userRole === 'mayorista' || userRole === 'admin'

  const subtotal = items.reduce((sum, { product, qty }) => {
    const price = isWholesale && product.price_wholesale != null ? product.price_wholesale : product.price
    return sum + price * qty
  }, 0)

  const deliveryPrice = zone?.delivery_price ?? 0
  const total = subtotal + deliveryPrice
  const minOrder = zone
    ? (isWholesale ? zone.min_order_wholesale : zone.min_order)
    : 0
  const meetsMinimum = subtotal >= minOrder

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        <p className="text-gray-600">Tu carrito está vacío.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Tu pedido</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {items.length} producto{items.length === 1 ? '' : 's'} · precios{' '}
          {isWholesale ? 'mayoristas' : 'minoristas'}
        </p>
      </div>

      <ul className="divide-y divide-gray-100">
        {items.map(({ product, qty }) => {
          const unitPrice =
            isWholesale && product.price_wholesale != null ? product.price_wholesale : product.price
          const imageSrc =
            (isWholesale ? product.images?.[1] ?? product.images?.[0] : product.images?.[0]) ||
            '/placeholders/default.svg'
          return (
            <li key={product.id} className="flex gap-3 items-center px-5 py-3">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                <Image src={imageSrc} alt={product.name} fill sizes="56px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-500">{formatPrice(unitPrice)} / {product.unit}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateQty(product.id, qty - 1)}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                    aria-label="Restar uno"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-sm font-medium w-5 text-center tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(product.id, qty + 1)}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                    aria-label="Sumar uno"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm text-gray-900 tabular-nums">
                  {formatPrice(unitPrice * qty)}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  className="mt-1 text-gray-400 hover:text-rose-600"
                  aria-label="Quitar del pedido"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="px-5 py-4 border-t border-gray-100 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Despacho {zone ? `(${zone.name})` : '—'}</span>
          <span className="tabular-nums">
            {zone ? formatPrice(deliveryPrice) : 'Elige una comuna'}
          </span>
        </div>
        <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(total)}</span>
        </div>
        {zone && !meetsMinimum && (
          <p className="text-xs text-rose-600 mt-2">
            Pedido mínimo {formatPrice(minOrder)}. Te faltan {formatPrice(minOrder - subtotal)}.
          </p>
        )}
      </div>
    </div>
  )
}
