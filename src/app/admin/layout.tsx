import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShoppingBag, Package, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const navItems = [
  { href: '/admin', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/zonas', label: 'Zonas', icon: MapPin },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // El proxy ya verifica que haya sesión. Acá comprobamos el rol —
  // la sesión sola no alcanza, también podría ser un mayorista logueado.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/mayorista/login?next=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Admin header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🥦</span>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--green-dark)' }}>El Menú · Panel Admin</p>
              <p className="text-xs text-gray-500">Solo para uso interno</p>
            </div>
          </div>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Ver sitio</Link>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <nav className="hidden md:flex flex-col w-52 py-6 px-3 gap-1 border-r border-gray-200 bg-white shrink-0">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-gray-500"
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
