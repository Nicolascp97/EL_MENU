'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Product, Category, UserRole } from '@/types/database'
import CatalogHero from './CatalogHero'
import CategoryStrip from './CategoryStrip'
import ProductCard from './ProductCard'

type Mode = 'minorista' | 'mayorista'

/** Slug "virtual" para la sección de ofertas (no existe en DB). */
export const OFERTAS_SLUG = 'ofertas'

/** Quita acentos y pasa a minúsculas para comparaciones tolerantes. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Productos que llevan "oferta" en el nombre van a la sección Ofertas. */
function isOferta(p: { name: string }): boolean {
  return normalize(p.name).includes('oferta')
}

type Props = {
  mode: Mode
  products: Product[]
  categories: Category[]
  /** Rol del usuario logueado, null = visitante anónimo. */
  userRole: UserRole | null
  initialSearch?: string
  initialCategory?: string | null
}

export default function CatalogClient({
  mode,
  products,
  categories,
  userRole,
  initialSearch = '',
  initialCategory = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(initialSearch)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory)

  // Sincronizamos la URL con los filtros (con debounce de 300ms para no
  // spammear router.replace en cada tecla). Permite compartir links como
  // /catalogo?q=tomate&cat=verduras.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (selectedCategory) params.set('cat', selectedCategory)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 300)
    return () => clearTimeout(t)
  }, [search, selectedCategory, pathname, router])

  const wholesaleMode = mode === 'mayorista'
  const canPurchase =
    mode === 'minorista' || userRole === 'mayorista' || userRole === 'admin'

  // Para el strip: cuántos productos hay por categoría + ofertas.
  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const p of products) {
      const slug = p.category?.slug
      if (slug) acc[slug] = (acc[slug] ?? 0) + 1
    }
    return acc
  }, [products])

  const ofertasCount = useMemo(() => products.filter(isOferta).length, [products])

  const accent = wholesaleMode ? '#C4811A' : '#1B2B1E'

  // Solo mostramos categorías que tienen al menos un producto en el catálogo activo.
  const visibleCategories = useMemo(
    () => categories.filter(c => (counts[c.slug] ?? 0) > 0),
    [categories, counts]
  )

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    return products.filter(p => {
      if (selectedCategory === OFERTAS_SLUG) {
        if (!isOferta(p)) return false
      } else if (selectedCategory && p.category?.slug !== selectedCategory) {
        return false
      }
      if (!q) return true
      // Búsqueda tolerante a acentos sobre nombre, descripción y categoría.
      const haystack = normalize(
        `${p.name} ${p.description ?? ''} ${p.category?.name ?? ''}`
      )
      return haystack.includes(q)
    })
  }, [products, search, selectedCategory])

  const activeCategoryName =
    selectedCategory === OFERTAS_SLUG
      ? 'Ofertas'
      : selectedCategory
      ? categories.find(c => c.slug === selectedCategory)?.name
      : null

  return (
    <div className="space-y-8">
      <CatalogHero
        mode={mode}
        productCount={products.length}
        categoryCount={visibleCategories.length}
        search={search}
        onSearchChange={setSearch}
        canPurchase={canPurchase}
        userRole={userRole}
      />

      <section aria-label="Categorías" className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 px-1">Explorá por categoría</h2>
        <CategoryStrip
          categories={visibleCategories}
          counts={counts}
          totalCount={products.length}
          ofertasCount={ofertasCount}
          selected={selectedCategory}
          onChange={setSelectedCategory}
          accent={accent}
        />
      </section>

      <section aria-label="Productos" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold text-gray-900">
            {filtered.length} producto{filtered.length === 1 ? '' : 's'}
            {activeCategoryName && (
              <span className="text-gray-500 font-normal"> en {activeCategoryName}</span>
            )}
            {search && (
              <span className="text-gray-500 font-normal"> para “{search}”</span>
            )}
          </h2>
          {(search || selectedCategory) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory(null) }}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-white rounded-2xl border border-gray-100">
            <p className="text-5xl">🔍</p>
            <p className="text-gray-700 font-semibold">No encontramos resultados</p>
            <p className="text-sm text-gray-500">
              Probá con otra palabra o limpiá los filtros.
            </p>
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory(null) }}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full text-white"
              style={{ background: accent }}
            >
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                wholesaleMode={wholesaleMode}
                canPurchase={canPurchase}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
