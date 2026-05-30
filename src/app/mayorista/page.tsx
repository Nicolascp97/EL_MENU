import { createClient } from '@/lib/supabase/server'
import CatalogClient from '@/components/catalog/CatalogClient'
import Navbar from '@/components/catalog/Navbar'
import CartDrawer from '@/components/catalog/CartDrawer'
import type { Product, Category } from '@/types/database'

export const revalidate = 60

type SearchParams = Promise<{ q?: string; cat?: string }>

async function getData() {
  const supabase = await createClient()

  const [{ data: products }, { data: categories }] = await Promise.all([
    // Solo productos con precio_wholesale definido — así todo lo visible tiene precio mayorista.
    supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('active', true)
      .not('price_wholesale', 'is', null)
      .order('featured', { ascending: false })
      .order('name'),
    supabase.from('categories').select('*').order('order'),
  ])

  return {
    products: (products as Product[]) ?? [],
    categories: (categories as Category[]) ?? [],
  }
}

export default async function MayoristaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { products, categories } = await getData()
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
          mode="mayorista"
          products={products}
          categories={categories}
          userRole={null}
          initialSearch={params.q ?? ''}
          initialCategory={initialCategory}
        />
      </main>
    </div>
  )
}
