'use client'
import { useState } from 'react'
import { X, Minus, Plus, ShoppingBag, Trash2, CreditCard, Banknote, Home, Store } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import { resolvePresentation } from '@/lib/units'

const DELIVERY_PRICE = 2990

function OptionBtn({
  active, onClick, icon, label, sub,
}: {
  active: boolean; onClick: () => void
  icon: React.ReactNode; label: string; sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border-2 text-left transition-all w-full"
      style={{
        borderColor: active ? '#E8621A' : '#E5E7EB',
        background: active ? '#FDE8D8' : '#fff',
      }}
    >
      <span style={{ color: active ? '#E8621A' : '#9CA3AF', flexShrink: 0 }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-900 leading-tight truncate">{label}</p>
        <p className="text-[10px] text-gray-500 leading-tight">{sub}</p>
      </div>
    </button>
  )
}

export default function CartDrawer() {
  const { items, isOpen, toggleCart, updateQty, removeItem, clearCart, total, cartMode, itemPrice } = useCart()
  const [deliveryMethod, setDeliveryMethod] = useState<'domicilio' | 'tienda'>('domicilio')
  const [paymentMethod, setPaymentMethod] = useState<'webpay' | 'transfer'>('webpay')

  if (!isOpen) return null

  const deliveryFee = deliveryMethod === 'domicilio' ? DELIVERY_PRICE : 0
  const grandTotal = total() + deliveryFee
  const checkoutHref = `/checkout?delivery=${deliveryMethod}&payment=${paymentMethod}&mode=${cartMode}`

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={toggleCart}
      />

      {/* Drawer */}
      <aside aria-label="Carrito de compras" className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
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
            items.map(({ product, qty }) => {
              const presentation = resolvePresentation(product, { wholesale: cartMode === 'mayorista' })
              return (
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
                  <p className="text-xs text-gray-500">{formatPrice(itemPrice(product))} / {presentation.label}</p>
                  {presentation.perMeasure && <p className="text-[11px] text-gray-500">{presentation.perMeasure}</p>}
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
                    {formatPrice(itemPrice(product) * qty)}
                  </p>
                  <button onClick={() => removeItem(product.id)} className="mt-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-3">

            {/* Entrega + Pago en una sola fila de 2 columnas cada sección */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entrega</p>
              <OptionBtn
                active={deliveryMethod === 'domicilio'}
                onClick={() => setDeliveryMethod('domicilio')}
                icon={<Home size={13} />}
                label="A domicilio"
                sub={`+${formatPrice(DELIVERY_PRICE)}`}
              />
              <OptionBtn
                active={deliveryMethod === 'tienda'}
                onClick={() => setDeliveryMethod('tienda')}
                icon={<Store size={13} />}
                label="Retiro en tienda"
                sub="Gratis"
              />
              <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Pago</p>
              <OptionBtn
                active={paymentMethod === 'webpay'}
                onClick={() => setPaymentMethod('webpay')}
                icon={<CreditCard size={13} />}
                label="Transbank"
                sub="Débito y crédito"
              />
              <OptionBtn
                active={paymentMethod === 'transfer'}
                onClick={() => setPaymentMethod('transfer')}
                icon={<Banknote size={13} />}
                label="Transferencia"
                sub="Banco Santander"
              />
            </div>

            {/* Totales */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span>{formatPrice(total())}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Despacho</span>
                <span>{deliveryFee === 0 ? 'Gratis' : formatPrice(deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-gray-900 border-t border-gray-100 pt-1.5">
                <span>Total estimado</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <Link
              href={checkoutHref}
              onClick={toggleCart}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#1B2B1E', color: '#fff' }}
            >
              {paymentMethod === 'webpay' ? <CreditCard size={16} /> : <Banknote size={16} />}
              Continuar al pago
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
