'use client'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Check, Lock } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '@/types/database'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'

type Props = {
  product: Product
  wholesaleMode?: boolean
  /** Si false, oculta el botón "agregar" y muestra CTA para registrarse. */
  canPurchase?: boolean
}

export default function ProductCard({
  product,
  wholesaleMode = false,
  canPurchase = true,
}: Props) {
  const addItem = useCart(s => s.addItem)
  const [added, setAdded] = useState(false)

  const hasWholesale = wholesaleMode && product.price_wholesale != null
  const mainPrice = hasWholesale ? product.price_wholesale! : product.price
  const compareAt = hasWholesale ? product.price : null
  const savings = compareAt != null && compareAt > mainPrice ? compareAt - mainPrice : 0
  const savingsPct = compareAt && savings > 0 ? Math.round((savings / compareAt) * 100) : 0

  // Convención de images: [0]=minorista bg, [1]=mayorista bg (opcional).
  // En modo mayorista preferimos [1], cayendo a [0] si no hay; en minorista usamos [0].
  const imgs = product.images ?? []
  const imageSrc =
    (wholesaleMode ? imgs[1] ?? imgs[0] : imgs[0]) || '/placeholders/default.svg'

  function handleAdd() {
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  const accent = wholesaleMode ? '#C4811A' : '#1B2B1E'
  const accentSoft = wholesaleMode ? '#FDF1DC' : '#D8F3DC'

  return (
    <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
      {/* Imagen */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Categoría chip top-left */}
        {product.category && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm"
            style={{ color: accent }}
          >
            <span aria-hidden>{product.category.emoji}</span> {product.category.name}
          </span>
        )}

        {/* Badge top-right */}
        {savingsPct >= 5 ? (
          <span className="absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white bg-orange-500">
            −{savingsPct}%
          </span>
        ) : product.featured ? (
          <span className="absolute top-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white bg-orange-500">
            ⭐ Destacado
          </span>
        ) : product.stock < 5 && product.stock > 0 ? (
          <span className="absolute top-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white bg-rose-500">
            Últimas
          </span>
        ) : null}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{product.description}</p>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="font-bold text-lg leading-none" style={{ color: accent }}>
                {formatPrice(mainPrice)}
              </p>
              {compareAt != null && compareAt > mainPrice && (
                <p className="text-xs text-gray-400 line-through">{formatPrice(compareAt)}</p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">/ {product.unit}</p>
          </div>

          {product.stock === 0 ? (
            <span
              className="inline-flex items-center justify-center h-9 px-3 rounded-full text-xs font-semibold bg-gray-100 text-gray-500"
              aria-label="Sin stock"
            >
              Agotado
            </span>
          ) : canPurchase ? (
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center justify-center w-10 h-10 rounded-full text-white transition-transform hover:scale-105 active:scale-95 shrink-0"
              style={{ backgroundColor: added ? '#52B788' : '#E8621A' }}
              aria-label={`Agregar ${product.name} al carrito`}
            >
              {added ? <Check size={16} /> : <Plus size={18} />}
            </button>
          ) : (
            <Link
              href={`/mayorista/registro?next=/mayorista`}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-xs font-semibold border shrink-0"
              style={{ color: accent, borderColor: accent, backgroundColor: accentSoft }}
              title="Solo cuentas empresa pueden comprar al por mayor"
            >
              <Lock size={12} />
              Solo empresas
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
