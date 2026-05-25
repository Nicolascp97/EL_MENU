'use client'
import Link from 'next/link'
import { ShoppingCart, Phone, Menu, X, ShieldCheck, User, LogOut, ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/hooks/useCart'
import UserMenu from '@/components/auth/UserMenu'
import { createClient } from '@/lib/supabase/client'
import { signOutAction } from '@/app/auth/actions'
import { useChatStore } from '@/hooks/useChatStore'

type UserSnap = { name: string | null; email: string; role: string } | null

export default function Navbar() {
  const items = useCart(s => s.items)
  const toggleCart = useCart(s => s.toggleCart)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cartBump, setCartBump] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userSnap, setUserSnap] = useState<UserSnap>(null)
  const openChat = useChatStore(s => s.openChat)
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
              {/* Menucito */}
              <button
                type="button"
                onClick={() => { setMobileOpen(false); openChat() }}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm transition-colors w-full text-left"
                style={{ background: '#E8621A', color: '#fff' }}
              >
                {/* Robot face mini */}
                <svg width="20" height="17" viewBox="0 0 36 30" fill="none" className="shrink-0">
                  <rect x="3" y="2" width="30" height="24" rx="7" fill="rgba(255,255,255,0.15)"/>
                  <rect x="0" y="10" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.35)"/>
                  <rect x="33" y="10" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.35)"/>
                  <circle cx="12" cy="13" r="4.5" fill="white"/>
                  <circle cx="12" cy="13" r="2.4" fill="#E8621A"/>
                  <circle cx="13" cy="12" r="0.9" fill="white"/>
                  <circle cx="24" cy="13" r="4.5" fill="white"/>
                  <circle cx="24" cy="13" r="2.4" fill="#E8621A"/>
                  <circle cx="25" cy="12" r="0.9" fill="white"/>
                  <path d="M10 23 Q18 29 26 23" stroke="rgba(255,255,255,0.82)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                </svg>
                Hablar con Menucito
              </button>

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
