'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ShoppingBag, Package, MapPin, ChefHat, LogOut, Store, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/admin', label: 'Pedidos', icon: ShoppingBag, exact: true },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/zonas', label: 'Zonas', icon: MapPin },
  { href: '/admin/recetas', label: 'Recetas IA', icon: ChefHat },
  { href: '/admin/mayoristas', label: 'Mayoristas', icon: Building2 },
  { href: '/catalogo', label: 'Catálogo', icon: Store, exact: false },
]

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const sb = createClient()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function signOut() {
    await sb.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex"
        style={{
          width: 220, background: '#1B2B1E', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, background: '#2D5A3D', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              🥦
            </div>
            <div>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 15, color: '#F0FFF4', margin: 0, lineHeight: 1.2 }}>
                El Menú
              </p>
              <p style={{ fontSize: 11, color: '#6B9B7A', margin: 0 }}>Panel Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            // El link al catálogo nunca se marca como activo dentro del admin
            const active = href.startsWith('/admin') ? isActive(href, exact) : false
            const isCatalog = href === '/catalogo'
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  marginTop: isCatalog ? 8 : 0,
                  borderTop: isCatalog ? '1px solid rgba(255,255,255,.06)' : 'none',
                  paddingTop: isCatalog ? 18 : 10,
                  background: active ? '#fff' : 'transparent',
                  color: active ? '#1B2B1E' : isCatalog ? '#A8C5A0' : '#8DB89A',
                  fontWeight: active ? 600 : isCatalog ? 500 : 400, fontSize: 14,
                  textDecoration: 'none', transition: 'background .12s, color .12s',
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 10px 18px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, background: '#2D5A3D', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#9DC4AA', fontWeight: 700, flexShrink: 0,
            }}>
              {userEmail[0]?.toUpperCase() ?? 'A'}
            </div>
            <p style={{ fontSize: 11, color: '#6B9B7A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {userEmail}
            </p>
          </div>
          <button
            onClick={signOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
              color: '#8DB89A', fontSize: 12, background: 'transparent', cursor: 'pointer',
            }}
          >
            <LogOut size={12} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#1B2B1E', display: 'flex', zIndex: 50,
          borderTop: '1px solid rgba(255,255,255,.08)', paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, padding: '10px 4px 12px',
                color: active ? '#7FD4A3' : '#6B9B7A',
                textDecoration: 'none', fontSize: 10,
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
