'use client'
import type { Category } from '@/types/database'

const OFERTAS_SLUG = 'ofertas'
const OFERTAS_ACCENT = '#F5872A'

type Props = {
  categories: Category[]
  /** slug → cantidad de productos en esa categoría */
  counts: Record<string, number>
  totalCount: number
  /** Cantidad de productos que llevan "Oferta" en el nombre. Si > 0,
   *  renderizamos la card especial "Ofertas" al inicio (color cálido,
   *  independiente del modo del catálogo). */
  ofertasCount?: number
  selected: string | null
  onChange: (slug: string | null) => void
  /** Color del estado activo (verde para minorista, dorado para mayorista). */
  accent: string
}

export default function CategoryStrip({
  categories,
  counts,
  totalCount,
  ofertasCount = 0,
  selected,
  onChange,
  accent,
}: Props) {
  return (
    <div className="-mx-4 sm:mx-0">
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-0 pb-3 scrollbar-hide">
        <CategoryCard
          emoji="🛒"
          name="Todas"
          count={totalCount}
          isActive={!selected}
          onClick={() => onChange(null)}
          accent={accent}
        />
        {ofertasCount > 0 && (
          <CategoryCard
            emoji="🏷️"
            name="Ofertas"
            count={ofertasCount}
            isActive={selected === OFERTAS_SLUG}
            onClick={() => onChange(selected === OFERTAS_SLUG ? null : OFERTAS_SLUG)}
            accent={OFERTAS_ACCENT}
            highlight
          />
        )}
        {categories.map(cat => (
          <CategoryCard
            key={cat.id}
            emoji={cat.emoji ?? '🥦'}
            name={cat.name}
            count={counts[cat.slug] ?? 0}
            isActive={selected === cat.slug}
            onClick={() => onChange(cat.slug === selected ? null : cat.slug)}
            accent={accent}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryCard({
  emoji,
  name,
  count,
  isActive,
  onClick,
  accent,
  highlight = false,
}: {
  emoji: string
  name: string
  count: number
  isActive: boolean
  onClick: () => void
  accent: string
  /** Si true, la card siempre tiene borde de color (incluso inactiva) para destacarla. */
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all border w-24"
      style={
        isActive
          ? { background: accent, color: '#fff', borderColor: accent }
          : highlight
          ? { background: '#FDF1DC', color: '#1B2B1E', borderColor: accent }
          : { background: '#fff', color: '#1B2B1E', borderColor: '#E4E9E5' }
      }
      aria-pressed={isActive}
    >
      <span
        className="text-3xl grid place-items-center w-14 h-14 rounded-full"
        style={
          isActive
            ? { background: 'rgba(255,255,255,.18)' }
            : highlight
            ? { background: '#fff' }
            : { background: '#F7FEE7' }
        }
        aria-hidden
      >
        {emoji}
      </span>
      <span className="text-[13px] font-semibold leading-none">{name}</span>
      <span
        className="text-[11px] tabular-nums leading-none"
        style={{ color: isActive ? 'rgba(255,255,255,.85)' : '#6B7A6F' }}
      >
        {count} prod.
      </span>
    </button>
  )
}
