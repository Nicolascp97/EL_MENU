import { createClient } from '@/lib/supabase/server'
import ProductsAdminClient from '@/components/admin/ProductsAdminClient'
import type { Product, Category } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const supabase = await createClient()
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*, category:categories(*)').order('name'),
    supabase.from('categories').select('*').order('order'),
  ])

  return (
    <ProductsAdminClient
      initialProducts={(products as Product[]) || []}
      categories={(categories as Category[]) || []}
    />
  )
}
