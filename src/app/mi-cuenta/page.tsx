import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogOut, User, Phone, Mail, MapPin, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/auth/actions'
import Navbar from '@/components/catalog/Navbar'
import { formatPrice } from '@/lib/utils'
import type { Order, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<Profile['role'], string> = {
  minorista: 'Cliente minorista',
  mayorista: 'Cliente mayorista',
  admin: 'Administrador',
}

const ROLE_TINT: Record<Profile['role'], string> = {
  minorista: 'bg-gray-100 text-gray-800',
  mayorista: 'bg-emerald-50 text-emerald-800',
  admin: 'bg-amber-50 text-amber-800',
}

const STATUS_LABEL: Record<Order['status'], string> = {
  nuevo: 'Recibido',
  preparando: 'Preparando',
  listo: 'Listo para despacho',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const STATUS_TINT: Record<Order['status'], string> = {
  nuevo: 'bg-blue-50 text-blue-800 border-blue-200',
  preparando: 'bg-amber-50 text-amber-800 border-amber-200',
  listo: 'bg-violet-50 text-violet-800 border-violet-200',
  en_camino: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  entregado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelado: 'bg-rose-50 text-rose-800 border-rose-200',
}

export default async function MiCuentaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/mayorista/login?next=/mi-cuenta')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const role = profile?.role ?? 'minorista'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Mi cuenta
          </h1>
          <p className="text-sm text-gray-500">
            Gestiona tus datos, revisa tus pedidos y cerrá sesión cuando quieras.
          </p>
        </header>

        {/* PERFIL */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Datos personales</h2>
              <p className="text-xs text-gray-500 mt-0.5">La información que usamos para tus despachos.</p>
            </div>
            <span className={`text-[11px] font-bold tracking-wide uppercase rounded-full px-2.5 py-1 ${ROLE_TINT[role]}`}>
              {ROLE_LABEL[role]}
            </span>
          </div>
          <dl className="divide-y divide-gray-100">
            <Row icon={<User size={16} />} label="Nombre" value={profile?.name ?? '—'} />
            <Row icon={<Mail size={16} />} label="Correo" value={user.email ?? '—'} />
            <Row icon={<Phone size={16} />} label="Teléfono" value={profile?.phone ?? '—'} />
            <Row icon={<MapPin size={16} />} label="Dirección" value={profile?.address ?? '—'} />
          </dl>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            ¿Necesitas cambiar algún dato? Escríbenos por{' '}
            <a
              href="https://wa.me/56954952395?text=Hola!%20Quiero%20actualizar%20los%20datos%20de%20mi%20cuenta"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-700 hover:underline"
            >
              WhatsApp
            </a>{' '}
            y lo modificamos por vos.
          </div>
        </section>

        {/* PEDIDOS */}
        <section id="pedidos" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Mis pedidos</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Los últimos 20 pedidos asociados a tu cuenta.
            </p>
          </div>
          {!orders || orders.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <div className="text-5xl">🛒</div>
              <p className="text-sm text-gray-500">Todavía no hiciste ningún pedido.</p>
              <Link
                href={role === 'mayorista' ? '/mayorista' : '/catalogo'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white"
                style={{ background: '#1B2B1E' }}
              >
                <ShoppingBag size={16} /> Ir al catálogo
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(orders as Order[]).map(o => {
                const date = new Date(o.created_at).toLocaleDateString('es-CL', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
                return (
                  <li key={o.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Pedido #{o.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">{date} · {o.items.length} producto{o.items.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 border ${STATUS_TINT[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {formatPrice(o.total)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* CERRAR SESIÓN */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cerrar sesión</h2>
            <p className="text-xs text-gray-500 mt-0.5">Vas a poder volver a ingresar cuando quieras.</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-6 py-3.5 flex items-center gap-3">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <dt className="text-xs uppercase tracking-wide text-gray-500 w-28 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 truncate flex-1">{value}</dd>
    </div>
  )
}
