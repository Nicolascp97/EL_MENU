/**
 * Helper de acceso directo a Supabase con service role key.
 * Solo para verificación en tests — nunca en código de producción.
 */
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Asegúrate de que playwright.config.ts cargue el .env.local.'
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type Order = {
  id: string
  user_id: string | null
  channel: string
  status: string
  payment_status: string
  total: number
  items: { product_id: string; product_name: string; qty: number; unit_price: number; unit: string }[]
  address: string
  commune: string
  phone: string
  notes: string | null
  transbank_token: string | null
  created_at: string
}

export type Product = {
  id: string
  name: string
  price: number
  unit: string
  images: string[]
  stock: number
}

export type Zone = {
  id: string
  name: string
  communes: string[]
  delivery_price: number
  min_order: number
  min_order_wholesale: number
}

/** Retorna productos activos, no-mayoristas y con stock. */
export async function getActiveProducts(limit = 3): Promise<Product[]> {
  const db = getAdminClient()
  const { data, error } = await db
    .from('products')
    .select('id, name, price, unit, images, stock')
    .eq('active', true)
    .eq('wholesale_only', false)
    .gt('stock', 0)
    .limit(limit)
  if (error) throw new Error(`Error obteniendo productos: ${error.message}`)
  return (data ?? []) as Product[]
}

/** Retorna la primera zona disponible con sus comunas. */
export async function getFirstZone(): Promise<Zone | null> {
  const db = getAdminClient()
  const { data, error } = await db
    .from('zones')
    .select('*')
    .limit(1)
    .single()
  if (error) return null
  return data as Zone
}

/** Retorna un pedido por su ID. */
export async function getOrderById(orderId: string): Promise<Order> {
  const db = getAdminClient()
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()
  if (error) throw new Error(`Pedido ${orderId} no encontrado: ${error.message}`)
  return data as Order
}

/** Retorna los pedidos creados desde `since` (útil para verificar tras un test). */
export async function getOrdersSince(since: Date): Promise<Order[]> {
  const db = getAdminClient()
  const { data, error } = await db
    .from('orders')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Error obteniendo pedidos: ${error.message}`)
  return (data ?? []) as Order[]
}

/** Retorna los usuarios de Auth creados desde `since`. Pagina hasta 10k usuarios. */
export async function getAuthUsersSince(since: Date) {
  const db = getAdminClient()
  let allUsers: { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown>; raw_user_meta_data?: Record<string, unknown> }[] = []
  let page = 1
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Error listando usuarios: ${error.message}`)
    allUsers = allUsers.concat(data.users as typeof allUsers)
    if (data.users.length < 1000) break
    page++
  }
  return allUsers.filter(u => new Date(u.created_at) >= since)
}

export type AuthUser = { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown>; raw_user_meta_data?: Record<string, unknown> }

/** Retorna un usuario de Auth por ID (lookup directo, O(1)). */
export async function getAuthUserById(id: string): Promise<AuthUser | undefined> {
  const db = getAdminClient()
  const { data, error } = await db.auth.admin.getUserById(id)
  if (error || !data?.user) return undefined
  const u = data.user
  return {
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    user_metadata: u.user_metadata as Record<string, unknown>,
    raw_user_meta_data: (u as Record<string, unknown>).raw_user_meta_data as Record<string, unknown>,
  }
}

/** Retorna un usuario de Auth por email.
 *  Primero intenta la GoTrue admin filter API (rápida, O(1)).
 *  Si falla, pagina listUsers como fallback. */
export async function getAuthUserByEmail(email: string): Promise<AuthUser | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars')

  // Intento 1: GoTrue admin API con filter (más rápido que paginar)
  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=50`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    )
    if (res.ok) {
      const body = await res.json() as { users?: AuthUser[] }
      const user = (body.users ?? []).find(u => u.email === email)
      if (user) return user
    }
  } catch { /* filter API not available, fall through */ }

  // Intento 2: paginar listUsers (fallback)
  const db = getAdminClient()
  let page = 1
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) break
    console.log(`[getAuthUserByEmail] page=${page} users=${data.users.length} total=${data.total} nextPage=${data.nextPage}`)
    const user = data.users.find(u => u.email === email)
    if (user) return user as AuthUser
    if (data.nextPage === null || data.nextPage === undefined) break
    page = data.nextPage
  }
  return undefined
}

/** Elimina un usuario de Auth por ID (cleanup de tests). */
export async function deleteAuthUserById(id: string) {
  const db = getAdminClient()
  await db.auth.admin.deleteUser(id)
}

/** Elimina un usuario de Auth por email (cleanup de tests). */
export async function deleteAuthUserByEmail(email: string) {
  const db = getAdminClient()
  const user = await getAuthUserByEmail(email)
  if (user?.id) {
    await db.auth.admin.deleteUser(user.id)
  }
}
