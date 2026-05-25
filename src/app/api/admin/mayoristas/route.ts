import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notifyMayoristaAprobado } from '@/lib/notify'

/** Verifica que el caller sea admin. */
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  return profile?.role === 'admin' ? user : null
}

/**
 * Lee mayorista_requested de user_metadata O raw_user_meta_data
 * (Supabase puede exponer ambos según la versión del cliente)
 */
function hasMayoristaRequest(u: any): boolean {
  return (
    u?.user_metadata?.mayorista_requested === true ||
    u?.raw_user_meta_data?.mayorista_requested === true
  )
}

/** Extrae el nombre del usuario desde metadata (varios campos posibles) */
function nameFromUser(u: any, profile?: any): string {
  return (
    profile?.name ||
    u?.user_metadata?.name ||
    u?.raw_user_meta_data?.name ||
    u?.email?.split('@')[0] ||
    '—'
  )
}

/** Extrae el teléfono del usuario desde metadata */
function phoneFromUser(u: any, profile?: any): string | null {
  return (
    profile?.phone ||
    u?.user_metadata?.phone ||
    u?.raw_user_meta_data?.phone ||
    null
  )
}

// ─── GET /api/admin/mayoristas ────────────────────────────────────────────────
// pending  → usuarios auth con mayorista_requested = true (con o sin perfil)
// approved → perfiles con role = 'mayorista'
export async function GET() {
  const caller = await verifyAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1. Todos los usuarios auth
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  })
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const users = authData.users

  // 2. Filtrar los que tienen mayorista_requested: true
  //    (busca en user_metadata Y en raw_user_meta_data para mayor compatibilidad)
  const pendingUsers = users.filter(hasMayoristaRequest)
  const pendingIds   = pendingUsers.map(u => u.id)

  // 3. Intentar obtener perfiles — pueden no existir aún si el trigger
  //    de Supabase solo crea el perfil al confirmar email o al iniciar sesión
  const profileMap = new Map<string, any>()
  if (pendingIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, name, phone, role')
      .in('id', pendingIds)
    ;(profiles ?? []).forEach(p => profileMap.set(p.id, p))
  }

  // 4. Construir lista de pendientes:
  //    - Si existe perfil y su rol ya es 'mayorista' → ya fue aprobado, excluir
  //    - Si no existe perfil → mostrar igual (registro reciente sin perfil aún)
  //    - Si existe perfil con rol 'minorista' → mostrar como pendiente
  const pending = pendingUsers
    .filter(u => {
      const profile = profileMap.get(u.id)
      return !profile || profile.role === 'minorista'
    })
    .map(u => {
      const profile = profileMap.get(u.id)
      return {
        id:         u.id,
        name:       nameFromUser(u, profile),
        phone:      phoneFromUser(u, profile),
        email:      u.email ?? '',
        role:       profile?.role ?? 'minorista',
        created_at: u.created_at ?? '',
        hasProfile: !!profile,
      }
    })

  // 5. Todos los mayoristas aprobados
  const { data: approvedProfiles } = await admin
    .from('profiles')
    .select('id, name, phone, role')
    .eq('role', 'mayorista')

  const userMap = new Map(users.map(u => [u.id, u]))
  const approved = (approvedProfiles ?? []).map(p => {
    const u = userMap.get(p.id)
    return {
      id:         p.id,
      name:       nameFromUser(u, p),
      phone:      phoneFromUser(u, p),
      email:      u?.email ?? '',
      role:       p.role,
      created_at: u?.created_at ?? '',
      hasProfile: true,
    }
  })

  return NextResponse.json({ pending, approved })
}

// ─── PATCH /api/admin/mayoristas ─────────────────────────────────────────────
// Body: { userId: string, action: 'approve' | 'reject' }
export async function PATCH(req: Request) {
  const caller = await verifyAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.userId || !['approve', 'reject'].includes(body?.action)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const { userId, action } = body as { userId: string; action: 'approve' | 'reject' }
  const admin = createAdminClient()

  if (action === 'approve') {
    // Verificar si existe el perfil
    const { data: existing } = await admin
      .from('profiles').select('id').eq('id', userId).single()

    if (existing) {
      // Actualizar rol existente
      const { error } = await admin
        .from('profiles').update({ role: 'mayorista' }).eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // El perfil aún no existe → obtener datos del usuario auth y crearlo
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      if (!authUser.user) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
      }
      const u = authUser.user
      const { error } = await admin.from('profiles').insert({
        id:    userId,
        name:  nameFromUser(u),
        phone: phoneFromUser(u),
        role:  'mayorista',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Limpiar flag en auth metadata
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { mayorista_requested: false },
    })

    // Notificar a Celso que la aprobación fue exitosa
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    if (authUser.user) {
      notifyMayoristaAprobado({
        name:  nameFromUser(authUser.user),
        email: authUser.user.email ?? '',
      }).catch(() => {})
    }

  } else {
    // Rechazar: solo limpiar el flag
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { mayorista_requested: false },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
