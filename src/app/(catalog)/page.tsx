import { createClient } from '@/lib/supabase/server'
import HomeClient from './_components/HomeClient'

export default async function HomePage() {
  const sb = await createClient()

  const [{ data: featured }, { data: recipes }] = await Promise.all([
    sb.from('products')
      .select('*, category:categories(name,emoji)')
      .eq('active', true)
      .eq('featured', true)
      .eq('wholesale_only', false)
      .order('created_at', { ascending: false })
      .limit(20),

    sb.from('recipes')
      .select('*')
      .eq('active', true)
      .order('generated_at', { ascending: false })
      .limit(6),
  ])

  return <HomeClient featuredProducts={featured ?? []} recipes={recipes ?? []} />
}
