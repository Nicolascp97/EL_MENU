'use client'
import Link from 'next/link'
import { ShoppingCart, Phone, Menu, X, ShieldCheck, User, LogOut, ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/hooks/useCart'
import UserMenu from '@/components/auth/UserMenu'
import { createClient } from '@/lib/supabase/client'
import { signOutAction } from '@/app/auth/actions'

type UserSnap = { name: string | null; email: string; role: string } | null

export default function Navbar() {
  const items = useCart(s => s.items)
  const toggleCart = useCart(s => s.toggleCart)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cartBump, setCartBump] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userSnap, setUserSnap] = useState<UserSnap>(null)
  const prevCountRef = useRef<number | null>(null)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function loadUser(userId: string, email: string) {
      const { data: profile } = await supabase
        .from('profiles').select('role, name').eq('id', userId).single()
      if (active) {
        setIsAdmin(profile?.role === 'admin')
        setUserSnap(profile ? { name: profile.name ?? null, email, role: profile.role } : null)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user) loadUser(session.user.id, session.user.email ?? '')
      else { setIsAdmin(false); setUserSnap(null) }
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const itemCount = mounted ? items.reduce((sum, i) => sum + i.qty, 0) : 0

  useEffect(() => {
    const count = items.reduce((s, i) => s + i.qty, 0)
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      setCartBump(true)
      const t = setTimeout(() => setCartBump(false), 500)
      prevCountRef.current = count
      return () => clearTimeout(t)
    }
    prevCountRef.current = count
  }, [items])

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      {/* Top bar */}
      <div
        className="text-white py-1.5 px-4 text-center"
        style={{ backgroundColor: '#E8621A' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-dancing), cursive',
            fontSize: '1.15rem',
            letterSpacing: '0.01em',
            lineHeight: 1.3,
          }}
        >
          Tenemos esa Oferta que Sorprende
        </span>
      </div>

      {/* Main nav */}
      <nav className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">

        {/* Hamburger — mobile only, left */}
        <button
          className="md:hidden w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>

        {/* Logo — desktop left */}
        <Link href="/" className="hidden md:flex items-center shrink-0" aria-label="El Menú — inicio">
          <img src="/logo/elmenu-color.png" alt="El Menú" className="h-12 w-auto" />
        </Link>

        {/* Desktop links — center */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-6 text-sm font-medium text-gray-700">
          <Link href="/" className="hover:text-emerald-700 transition-colors">Inicio</Link>
          <Link href="/catalogo" className="hover:text-emerald-700 transition-colors">Catálogo</Link>
          <Link href="/mayorista" className="hover:text-emerald-700 transition-colors">Mayorista</Link>
        </div>

        {/* Mobile: spacer + logo right */}
        <div className="flex-1 md:hidden" />
        <Link href="/" className="md:hidden flex items-center shrink-0" aria-label="El Menú — inicio">
          <img src="/logo/elmenu-color.png" alt="El Menú" className="h-10 w-auto" />
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://wa.me/56954952395?text=Hola!%20Quiero%20hacer%20un%20pedido"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors text-emerald-900 bg-emerald-50 hover:bg-emerald-100"
          >
            <Phone size={14} />
            WhatsApp
          </a>

          <div className="hidden md:block">
            <UserMenu className="inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-gray-800 hover:bg-gray-100" />
          </div>

          <button
            onClick={toggleCart}
            className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors hover:bg-gray-100 ${cartBump ? 'cart-bump' : ''}`}
            aria-label="Ver carrito"
          >
            <ShoppingCart size={20} className="text-emerald-900" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white bg-orange-500">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile left-slide drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col md:hidden animate-slide-left">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <Link href="/" onClick={() => setMobileOpen(false)} aria-label="El Menú — inicio">
                <img src="/logo/elmenu-color.png" alt="El Menú" className="h-10 w-auto" />
              </Link>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 flex flex-col gap-1 text-base font-medium text-gray-800 overflow-y-auto">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors"
                  style={{ background: '#FDE8D8', color: '#C44D0F' }}
                >
                  <ShieldCheck size={18} />
                  Panel admin
                </Link>
              )}
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Inicio
              </Link>
              <Link
                href="/catalogo"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Catálogo
              </Link>
              <Link
                href="/mayorista"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Mayorista
              </Link>
              <Link
                href="/mi-cuenta"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Mi cuenta
              </Link>
            </nav>

            <div className="px-3 py-4 border-t border-gray-100 space-y-2">
              {/* WhatsApp */}
              <a
                href="https://wa.me/56954952395"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-sm transition-colors hover:bg-emerald-100"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Pedir por WhatsApp
              </a>

              {/* Cuenta — inline, sin dropdown anidado */}
              {userSnap ? (() => {
                const initials = (userSnap.name ?? userSnap.email)
                  .split(/[\s@.]+/).filter(Boolean).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '·'
                const roleBg = userSnap.role === 'admin' ? '#FDE6CC' : userSnap.role === 'mayorista' ? '#D8F3DC' : '#EEF1ED'
                return (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    {/* Cabecera usuario */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: '#1B2B1E' }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {userSnap.name ?? userSnap.email.split('@')[0]}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{userSnap.email}</div>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0"
                        style={{ background: roleBg, color: '#1B2B1E' }}
                      >
                        {userSnap.role}
                      </span>
                    </div>
                    {/* Links directos */}
                    <Link href="/mi-cuenta" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                      <User size={15} /> Mi perfil
                    </Link>
                    {userSnap.role === 'mayorista' && (
                      <Link href="/mayorista" onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                        <ShoppingBag size={15} /> Catálogo mayorista
                      </Link>
                    )}
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                        <ShieldCheck size={15} /> Panel admin
                      </Link>
                    )}
                    <Link href="/mi-cuenta" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                      <ShoppingBag size={15} /> Mis pedidos
                    </Link>
                    <form action={signOutAction}>
                      <button type="submit"
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-700 hover:bg-red-50 border-t border-gray-100 transition-colors">
                        <LogOut size={15} /> Cerrar sesión
                      </button>
                    </form>
                  </div>
                )
              })() : (
                <Link href="/mayorista/login" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 w-full transition-colors">
                  <User size={16} /> Ingresar
                </Link>
              )}
            </div>
          </aside>
        </>
      )}
    </header>
  )
}
