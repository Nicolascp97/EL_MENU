'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category } from '@/types/database'
import { formatPrice } from '@/lib/utils'
import { Pencil, Plus, ToggleLeft, ToggleRight, Star } from 'lucide-react'

type Props = {
  initialProducts: Product[]
  categories: Category[]
}

export default function ProductsAdminClient({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleActive(product: Product) {
    const updated = { ...product, active: !product.active }
    setProducts(prev => prev.map(p => p.id === product.id ? updated : p))
    await supabase.from('products').update({ active: !product.active }).eq('id', product.id)
  }

  async function toggleFeatured(product: Product) {
    const updated = { ...product, featured: !product.featured }
    setProducts(prev => prev.map(p => p.id === product.id ? updated : p))
    await supabase.from('products').update({ featured: !product.featured }).eq('id', product.id)
  }

  async function saveProduct() {
    if (!editing) return
    setSaving(true)
    if (editing.id) {
      const { data } = await supabase.from('products').update(editing).eq('id', editing.id).select('*, category:categories(*)').single()
      if (data) setProducts(prev => prev.map(p => p.id === data.id ? data as Product : p))
    } else {
      const { data } = await supabase.from('products').insert(editing).select('*, category:categories(*)').single()
      if (data) setProducts(prev => [data as Product, ...prev])
    }
    setSaving(false)
    setEditing(null)
  }

  async function updateStock(productId: string, stock: number) {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock } : p))
    await supabase.from('products').update({ stock }).eq('id', productId)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--green-dark)', fontFamily: 'var(--font-fraunces)' }}>
            Productos
          </h1>
          <p className="text-sm text-gray-500">{products.length} productos en catálogo</p>
        </div>
        <button
          onClick={() => setEditing({ active: true, featured: false, unit: 'kg', stock: 0, images: [] })}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--green-dark)' }}
        >
          <Plus size={16} />
          Nuevo producto
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 rounded-full border border-gray-200 text-sm focus:outline-none"
      />

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100">
            <tr className="text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Mayorista</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-center">Activo</th>
              <th className="px-4 py-3 text-center">Destacado</th>
              <th className="px-4 py-3 text-center">Editar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-400">{product.category?.name} · {product.unit}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatPrice(product.price)}</td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {product.price_wholesale ? formatPrice(product.price_wholesale) : '—'}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={product.stock}
                    onChange={e => updateStock(product.id, parseInt(e.target.value) || 0)}
                    className="w-16 text-center rounded-lg border border-gray-200 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(product)}>
                    {product.active
                      ? <ToggleRight size={22} style={{ color: 'var(--green-mid)' }} />
                      : <ToggleLeft size={22} className="text-gray-300" />
                    }
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleFeatured(product)}>
                    <Star
                      size={18}
                      fill={product.featured ? 'var(--accent)' : 'none'}
                      style={{ color: product.featured ? 'var(--accent)' : '#d1d5db' }}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setEditing(product)} className="text-gray-400 hover:text-gray-700">
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="font-bold text-lg" style={{ color: 'var(--green-dark)' }}>
              {editing.id ? 'Editar producto' : 'Nuevo producto'}
            </h2>

            <div className="space-y-3">
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Nombre del producto"
                value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                placeholder="Descripción (opcional)"
                rows={2}
                value={editing.description || ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Precio (CLP)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={editing.price || ''}
                    onChange={e => setEditing({ ...editing, price: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Precio mayorista</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={editing.price_wholesale || ''}
                    onChange={e => setEditing({ ...editing, price_wholesale: parseInt(e.target.value) || undefined })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unidad</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={editing.unit || 'kg'}
                    onChange={e => setEditing({ ...editing, unit: e.target.value })}
                  >
                    {['kg', 'unid', 'ramo', 'bolsa', 'maceta', 'caja'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Stock</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={editing.stock || 0}
                    onChange={e => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={editing.category_id || ''}
                  onChange={e => setEditing({ ...editing, category_id: e.target.value })}
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 rounded-full border border-gray-200 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={saveProduct}
                disabled={saving}
                className="flex-1 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--green-dark)' }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
