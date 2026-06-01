import { createClient } from '@/lib/supabase/server'
import CatalogClient from '@/components/catalog/CatalogClient'
import Navbar from '@/components/catalog/Navbar'
import CartDrawer from '@/components/catalog/CartDrawer'
import type { Product, Category, UserRole } from '@/types/database'

// Sin cache: cada visita golpea la DB y muestra los datos actuales.
// Necesario para que los cambios del panel admin (precios, stock, fotos,
// unidades, etc.) se vean reflejados de inmediato en el catálogo público.
export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ q?: string; cat?: string }>

async function getData() {
  const supabase = await createClient()

  const [{ data: products }, { data: categories }, { data: { user } }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('active', true)
      .eq('wholesale_only', false)
      .order('featured', { ascending: false })
      .order('name'),
    supabase.from('categories').select('*').order('order'),
    supabase.auth.getUser(),
  ])

  let role: UserRole | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = (profile?.role as UserRole) ?? 'minorista'
  }

  return {
    products: (products as Product[]) ?? [],
    categories: (categories as Category[]) ?? [],
    role,
  }
}

export default async function CatalogoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { products, categories, role } = await getData()
  const initialCategory =
    params.cat === 'ofertas'
      ? 'ofertas'
      : params.cat && categories.some(c => c.slug === params.cat)
      ? params.cat!
      : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <CartDrawer />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <CatalogClient
          mode="minorista"
          products={products}
          categories={categories}
          userRole={role}
          initialSearch={params.q ?? ''}
          initialCategory={initialCategory}
        />
      </main>
    </div>
  )
}
