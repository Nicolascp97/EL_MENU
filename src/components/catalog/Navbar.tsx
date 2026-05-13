'use client'
import Link from 'next/link'
import { ShoppingCart, Phone, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCart } from '@/hooks/useCart'
import UserMenu from '@/components/auth/UserMenu'

export default function Navbar() {
  const items = useCart(s => s.items)
  const toggleCart = useCart(s => s.toggleCart)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const itemCount = mounted ? items.reduce((sum, i) => sum + i.qty, 0) : 0

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      {/* Top bar */}
      <div className="text-white text-sm py-1.5 px-4 text-center" style={{ backgroundColor: '#1B2B1E' }}>
        🚚 Despachamos a toda la RM · Pedido mínimo $20.000 · Despacho plano $2.500
      </div>

      {/* Main nav */}
      <nav className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0" aria-label="El Menú — inicio">
          <img src="/logo/elmenu-color.png" alt="El Menú" className="h-12 w-auto" />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
          <Link href="/" className="hover:text-emerald-700 transition-colors">Inicio</Link>
          <Link href="/catalogo" className="hover:text-emerald-700 transition-colors">Catálogo</Link>
          <Link href="/mayorista" className="hover:text-emerald-700 transition-colors">Mayorista</Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://wa.me/56954952395?text=Hola!%20Quiero%20hacer%20un%20pedido"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors text-emerald-900 bg-emerald-50 hover:bg-emerald-100"
          >
            <Phone size={14} />
            WhatsApp
          </a>

          <UserMenu className="hidden md:inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-gray-800 hover:bg-gray-100" />

          <button
            onClick={toggleCart}
            className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-gray-100"
            aria-label="Ver carrito"
          >
            <ShoppingCart size={20} className="text-emerald-900" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white bg-orange-500">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>

          <button
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menú"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-3 text-sm font-medium text-gray-700">
          <Link href="/" onClick={() => setMobileOpen(false)}>Inicio</Link>
          <Link href="/catalogo" onClick={() => setMobileOpen(false)}>Catálogo</Link>
          <Link href="/mayorista" onClick={() => setMobileOpen(false)}>Mayorista</Link>
          <Link href="/mi-cuenta" onClick={() => setMobileOpen(false)}>Mi cuenta</Link>
          <a
            href="https://wa.me/56954952395"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-medium text-emerald-700"
          >
            <Phone size={14} />
            Pedir por WhatsApp
          </a>
          <div className="pt-2 border-t border-gray-100">
            <UserMenu className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gray-50 hover:bg-gray-100" />
          </div>
        </div>
      )}
    </header>
  )
}
