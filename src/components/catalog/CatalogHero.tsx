'use client'
import Link from 'next/link'
import { Search, Truck, ShieldCheck, Clock, FileText, Sparkles, X } from 'lucide-react'
import CatalogModeTabs from './CatalogModeTabs'
import type { UserRole } from '@/types/database'

type Mode = 'minorista' | 'mayorista'

type Props = {
  mode: Mode
  productCount: number
  categoryCount: number
  search: string
  onSearchChange: (v: string) => void
  /** Rol del usuario logueado (null = visitante anónimo). */
  userRole: UserRole | null
}

const CONFIG: Record<Mode, {
  tag: string
  title: string
  subtitle: string
  rules: { icon: React.ReactNode; text: string }[]
  accent: string
  accentSoft: string
  bgGradient: string
  bgDecoration: string
}> = {
  minorista: {
    tag: 'CATÁLOGO MINORISTA',
    title: 'Frutas y verduras frescas para tu casa.',
    subtitle: 'Como ir a la feria, pero sin salir de casa. Te llevamos frutas y verduras frescas directo a tu puerta.',
    rules: [
      { icon: <Truck size={14} />, text: 'Pedido mínimo $20.000' },
      { icon: <Truck size={14} />, text: 'Despacho único $2.990' },
      { icon: <ShieldCheck size={14} />, text: 'Garantía de frescura' },
    ],
    accent: '#1B2B1E',
    accentSoft: '#D8F3DC',
    bgGradient: 'linear-gradient(135deg,#EFF8F1 0%,#D8F3DC 100%)',
    bgDecoration: 'radial-gradient(circle at 85% 20%,rgba(45,106,79,.15),transparent 50%)',
  },
  mayorista: {
    tag: 'CATÁLOGO MAYORISTA',
    title: 'Precios al por mayor para tu negocio.',
    subtitle: 'Tu local abre con lo mejor del día. Dejamos frutas y verduras frescas en tu cocina antes de que lleguen tus clientes, con factura electrónica al instante.',
    rules: [
      { icon: <Truck size={14} />, text: 'Pedido mínimo $60.000' },
      { icon: <FileText size={14} />, text: 'Factura electrónica' },
      { icon: <Clock size={14} />, text: 'Pide hoy, recibe mañana' },
    ],
    accent: '#C4811A',
    accentSoft: '#FDF1DC',
    bgGradient: 'linear-gradient(135deg,#FBF6E9 0%,#FDF1DC 100%)',
    bgDecoration: 'radial-gradient(circle at 85% 20%,rgba(196,129,26,.18),transparent 50%)',
  },
}

export default function CatalogHero({
  mode,
  productCount,
  categoryCount,
  search,
  onSearchChange,
  userRole,
}: Props) {
  const cfg = CONFIG[mode]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <CatalogModeTabs active={mode} />
        <p className="text-xs text-gray-500 tabular-nums">
          {productCount} productos · {categoryCount} categorías
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-10"
        style={{ background: cfg.bgGradient }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: cfg.bgDecoration }}
        />
        <div className="relative max-w-2xl">
          <span
            className="inline-flex items-center text-[11px] font-bold tracking-[0.15em] rounded-full px-3 py-1"
            style={{ background: '#fff', color: cfg.accent }}
          >
            {cfg.tag}
          </span>
          <h1
            className="mt-4 text-3xl md:text-4xl font-bold text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', letterSpacing: '-0.02em' }}
          >
            {cfg.title}
          </h1>
          <p className="mt-3 text-sm md:text-base text-gray-700 max-w-xl">{cfg.subtitle}</p>

          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            <input
              type="search"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={
                mode === 'minorista'
                  ? 'Busca paltas, tomates, lechugas…'
                  : 'Busca cajas, sacos, productos…'
              }
              className="w-full h-12 pl-11 pr-11 rounded-full border border-gray-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 text-gray-900 placeholder:text-gray-400"
              style={{ '--tw-ring-color': cfg.accent } as React.CSSProperties}
              aria-label="Buscar productos"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {cfg.rules.map(r => (
              <span
                key={r.text}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5"
                style={{ background: '#fff', color: cfg.accent }}
              >
                <span aria-hidden style={{ color: cfg.accent }}>{r.icon}</span>
                {r.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <RoleBanner mode={mode} userRole={userRole} accent={cfg.accent} accentSoft={cfg.accentSoft} />
    </section>
  )
}

function RoleBanner({
  mode,
  userRole,
  accent,
  accentSoft,
}: {
  mode: Mode
  userRole: UserRole | null
  accent: string
  accentSoft: string
}) {
  // /catalogo + mayorista logueado: sugerencia de cambiar al catálogo correcto.
  if (mode === 'minorista' && userRole === 'mayorista') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <Sparkles size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900">Estás viendo precios minoristas</p>
          <p className="text-amber-800 text-xs mt-0.5">
            Como cuenta mayorista, puedes comprar con descuento por volumen.
          </p>
        </div>
        <Link
          href="/mayorista"
          className="shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 text-white"
          style={{ background: '#C4811A' }}
        >
          Ir al catálogo mayorista →
        </Link>
      </div>
    )
  }

  // /mayorista: banner informativo de mínimo de pedido
  if (mode === 'mayorista') {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-xs"
        style={{ background: accentSoft, borderColor: accent + '40', color: accent }}
      >
        <ShieldCheck size={16} />
        <p className="flex-1 font-semibold">
          Precios al por mayor · Pedido mínimo $60.000
          {userRole === 'admin' && ' · acceso admin'}
        </p>
      </div>
    )
  }

  return null
}
