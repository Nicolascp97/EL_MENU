'use client'
import Link from 'next/link'
import { ShoppingBasket, Briefcase } from 'lucide-react'

type Mode = 'minorista' | 'mayorista'

export default function CatalogModeTabs({ active }: { active: Mode }) {
  return (
    <div
      role="tablist"
      aria-label="Tipo de cliente"
      className="inline-flex p-1 rounded-full bg-white border border-gray-200 shadow-sm"
    >
      <Tab
        href="/catalogo"
        label="Minorista"
        sub="Familias y personas"
        icon={<ShoppingBasket size={16} />}
        active={active === 'minorista'}
        color="#1B2B1E"
      />
      <Tab
        href="/mayorista"
        label="Mayorista"
        sub="Empresas y revendedores"
        icon={<Briefcase size={16} />}
        active={active === 'mayorista'}
        color="#C4811A"
      />
    </div>
  )
}

function Tab({
  href,
  label,
  sub,
  icon,
  active,
  color,
}: {
  href: string
  label: string
  sub: string
  icon: React.ReactNode
  active: boolean
  color: string
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm transition-colors"
      style={
        active
          ? { background: color, color: '#fff' }
          : { color: '#3A4A3E' }
      }
    >
      <span aria-hidden style={active ? { color: '#fff' } : { color }}>
        {icon}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="font-semibold text-[13px]">{label}</span>
        <span
          className="text-[10px]"
          style={{ color: active ? 'rgba(255,255,255,.85)' : '#6B7A6F' }}
        >
          {sub}
        </span>
      </span>
    </Link>
  )
}
