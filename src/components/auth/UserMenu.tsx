'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { User, LogOut, ShoppingBag, ChevronDown, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { signOutAction } from '@/app/auth/actions'
import type { UserRole } from '@/types/database'

type Snap = { email: string; name: string | null; role: UserRole } | null

type Props = {
  /** Clase aplicada al botón trigger. El dropdown usa Tailwind y queda igual en ambos navbars. */
  className?: string
  /** Si true, muestra solo el ícono cuando hay sesión (para navbars compactos). */
  compact?: boolean
}

export default function UserMenu({ className = '', compact = false }: Props) {
  const [snap, setSnap] = useState<Snap>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setSnap(null)
        setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single()
      if (!active) return
      setSnap({
        email: user.email ?? '',
        name: profile?.name ?? null,
        role: (profile?.role as UserRole) ?? 'minorista',
      })
      setLoading(false)
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) setSnap(null)
      else load()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClickOutside)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (loading) {
    return (
      <button type="button" className={className} disabled style={{ opacity: 0.5 }} aria-busy="true">
        <User size={18} />
        <span>…</span>
      </button>
    )
  }

  if (!snap) {
    return (
      <Link href="/mayorista/login" className={className}>
        <User size={18} />
        <span>Ingresar</span>
      </Link>
    )
  }

  const initials = (snap.name ?? snap.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const first = snap.name?.split(/\s+/)[0] ?? snap.email.split('@')[0]
  const roleBg =
    snap.role === 'admin' ? '#FDE6CC' : snap.role === 'mayorista' ? '#D8F3DC' : '#EEF1ED'

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User size={18} />
        {!compact && <span>{first}</span>}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white shadow-xl z-[60] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-white shrink-0"
                style={{ background: '#1B2B1E' }}
                aria-hidden
              >
                {initials || '·'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {snap.name ?? first}
                </div>
                <div className="text-xs text-gray-500 truncate">{snap.email}</div>
              </div>
            </div>
            <div
              className="mt-2 inline-flex text-[10px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5"
              style={{ background: roleBg, color: '#1B2B1E' }}
            >
              {snap.role}
            </div>
          </div>

          <Link
            href="/mi-cuenta"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <User size={16} /> Mi perfil
          </Link>

          {snap.role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ShieldCheck size={16} /> Panel admin
            </Link>
          )}

          {snap.role === 'mayorista' && (
            <Link
              href="/mayorista"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ShoppingBag size={16} /> Catálogo mayorista
            </Link>
          )}

          <Link
            href="/mi-cuenta/pedidos"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ShoppingBag size={16} /> Mis pedidos
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 border-t border-gray-100"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
