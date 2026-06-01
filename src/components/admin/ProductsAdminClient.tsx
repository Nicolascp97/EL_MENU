'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category } from '@/types/database'
import { formatPrice } from '@/lib/utils'
import { Pencil, Plus, ToggleLeft, ToggleRight, Star, Search, X, Package, Image as ImageIcon, Upload } from 'lucide-react'

type Props = {
  initialProducts: Product[]
  categories: Category[]
}

const GREEN = '#1B2B1E'
const ACCENT = '#E8621A'
const UNIT_OPTIONS = ['kg', 'unid', 'ramo', 'bolsa', 'maceta', 'caja', 'paq', 'gr'] as const
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function ProductsAdminClient({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
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

    // Solo enviamos columnas reales de la tabla — excluimos `category` (join virtual)
    // y `created_at` / `id` que no deben modificarse.
    const payload = {
      name:           editing.name,
      description:    editing.description ?? null,
      price:          editing.price,
      price_wholesale: editing.price_wholesale ?? null,
      category_id:    editing.category_id ?? null,
      stock:              editing.stock ?? 0,
      unit:               editing.unit ?? 'kg',
      unit_wholesale:     editing.unit_wholesale ?? null,
      unit_qty:           editing.unit_qty ?? 1,
      unit_qty_wholesale: editing.unit_qty_wholesale ?? null,
      active:             editing.active ?? true,
      featured:       editing.featured ?? false,
      wholesale_only: editing.wholesale_only ?? false,
      images:         editing.images ?? [],
    }

    if (editing.id) {
      const { data, error } = await supabase
        .from('products').update(payload).eq('id', editing.id)
        .select('*, category:categories(*)').single()
      if (error) console.error('[saveProduct] update error:', error)
      if (data) setProducts(prev => prev.map(p => p.id === data.id ? data as Product : p))
    } else {
      const { data, error } = await supabase
        .from('products').insert(payload)
        .select('*, category:categories(*)').single()
      if (error) console.error('[saveProduct] insert error:', error)
      if (data) setProducts(prev => [data as Product, ...prev])
    }
    setSaving(false)
    setEditing(null)
  }

  async function updateStock(productId: string, stock: number) {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock } : p))
    await supabase.from('products').update({ stock }).eq('id', productId)
  }

  /** Sube una foto al bucket product-images y la setea como única imagen del
   *  producto en edición. Reemplaza la foto anterior (no acumula). */
  async function uploadImage(file: File) {
    if (!editing) return
    if (file.size > MAX_IMAGE_BYTES) {
      alert('La imagen no puede pesar más de 5 MB.')
      return
    }
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      alert('Formato no soportado. Usa JPG, PNG o WEBP.')
      return
    }
    setUploading(true)
    const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const baseName = editing.id ?? `new-${Date.now()}`
    const path     = `${baseName}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('product-images')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) {
      alert(`Error subiendo imagen: ${upErr.message}`)
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(path)
    setEditing(prev => (prev ? { ...prev, images: [publicUrl] } : prev))
    setUploading(false)
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 space-y-5 pb-24 md:pb-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: GREEN, fontFamily: 'var(--font-fraunces)' }}>
            Productos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} de {products.length} productos</p>
        </div>
        <button
          onClick={() => setEditing({ active: true, featured: false, unit: 'kg', stock: 0, images: [] })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white shrink-0"
          style={{ backgroundColor: GREEN }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nuevo producto</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* ── Buscador ── */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── MOBILE: tarjetas ── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Package size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No se encontraron productos</p>
          </div>
        )}
        {filtered.map(product => (
          <div
            key={product.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
            style={{ opacity: product.active ? 1 : 0.55 }}
          >
            {/* Nombre + categoría */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900 leading-tight">{product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {product.category?.name} · {product.unit}
                </p>
              </div>
              {/* Acciones rápidas */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleFeatured(product)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
                  title="Destacado"
                >
                  <Star
                    size={18}
                    fill={product.featured ? ACCENT : 'none'}
                    style={{ color: product.featured ? ACCENT : '#d1d5db' }}
                  />
                </button>
                <button
                  onClick={() => setEditing(product)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>

            {/* Precios + stock + toggle */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Precio</p>
                <p className="font-semibold text-gray-900">{formatPrice(product.price)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Mayorista</p>
                <p className="font-semibold text-gray-700">
                  {product.price_wholesale ? formatPrice(product.price_wholesale) : '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Stock</p>
                <input
                  type="number"
                  min="0"
                  value={product.stock}
                  onChange={e => updateStock(product.id, parseInt(e.target.value) || 0)}
                  className="w-full text-sm font-semibold bg-transparent focus:outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Toggle activo */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-50">
              <span className="text-xs text-gray-500">{product.active ? 'Activo en catálogo' : 'Inactivo (oculto)'}</span>
              <button onClick={() => toggleActive(product)}>
                {product.active
                  ? <ToggleRight size={26} style={{ color: '#2D6A4F' }} />
                  : <ToggleLeft size={26} className="text-gray-300" />
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Mayorista</th>
              <th className="px-4 py-3 text-center w-24">Stock</th>
              <th className="px-4 py-3 text-center w-20">Activo</th>
              <th className="px-4 py-3 text-center w-20">Destac.</th>
              <th className="px-4 py-3 text-center w-16">Editar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  No se encontraron productos
                </td>
              </tr>
            )}
            {filtered.map(product => (
              <tr
                key={product.id}
                className="hover:bg-gray-50/60 transition-colors"
                style={{ opacity: product.active ? 1 : 0.5 }}
              >
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-400">{product.category?.name} · {product.unit}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatPrice(product.price)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                  {product.price_wholesale ? formatPrice(product.price_wholesale) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min="0"
                    value={product.stock}
                    onChange={e => updateStock(product.id, parseInt(e.target.value) || 0)}
                    className="w-16 text-center rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(product)} className="inline-flex">
                    {product.active
                      ? <ToggleRight size={24} style={{ color: '#2D6A4F' }} />
                      : <ToggleLeft size={24} className="text-gray-300" />
                    }
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleFeatured(product)} className="inline-flex">
                    <Star
                      size={18}
                      fill={product.featured ? ACCENT : 'none'}
                      style={{ color: product.featured ? ACCENT : '#d1d5db' }}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setEditing(product)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal edición ── */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92dvh] overflow-y-auto">
            {/* Handle mobile */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-6 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg" style={{ color: GREEN, fontFamily: 'var(--font-fraunces)' }}>
                  {editing.id ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <button
                  onClick={() => setEditing(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre del producto *</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Ej: Tomates cherry 500g"
                    value={editing.name || ''}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Descripción</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Descripción opcional"
                    rows={2}
                    value={editing.description || ''}
                    onChange={e => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Precio (CLP) *</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="0"
                      value={editing.price || ''}
                      onChange={e => setEditing({ ...editing, price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Precio mayorista</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="Opcional"
                      value={editing.price_wholesale || ''}
                      onChange={e => setEditing({ ...editing, price_wholesale: parseInt(e.target.value) || undefined })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_1fr] gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Cantidad minorista</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="1"
                      value={editing.unit_qty ?? 1}
                      onChange={e => setEditing({ ...editing, unit_qty: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Unidad minorista</label>
                    <select
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                      value={editing.unit || 'kg'}
                      onChange={e => setEditing({ ...editing, unit: e.target.value })}
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_1fr] gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Cantidad mayorista</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="— igual que minorista —"
                      value={editing.unit_qty_wholesale ?? ''}
                      onChange={e => {
                        const v = e.target.value
                        setEditing({ ...editing, unit_qty_wholesale: v === '' ? null : Number(v) })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Unidad mayorista</label>
                    <select
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                      value={editing.unit_wholesale ?? ''}
                      onChange={e => setEditing({ ...editing, unit_wholesale: e.target.value || null })}
                    >
                      <option value="">— igual que minorista —</option>
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Stock inicial</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="0"
                    value={editing.stock ?? 0}
                    onChange={e => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Categoría</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                    value={editing.category_id || ''}
                    onChange={e => setEditing({ ...editing, category_id: e.target.value })}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Foto del producto */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Foto del producto</label>
                  <div className="flex items-center gap-3">
                    {editing.images && editing.images.length > 0 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={editing.images[0]}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploading}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) uploadImage(f)
                          e.target.value = '' // permite re-elegir el mismo archivo
                        }}
                      />
                      <span
                        className="flex items-center justify-center gap-2 w-full text-center px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        style={{ opacity: uploading ? 0.6 : 1 }}
                      >
                        <Upload size={14} />
                        {uploading
                          ? 'Subiendo...'
                          : editing.images?.length
                            ? 'Reemplazar foto'
                            : 'Subir foto'}
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG o WEBP · máx 5 MB</p>
                </div>

                {/* Toggles activo / destacado */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, active: !editing.active })}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: editing.active ? '#2D6A4F' : '#e5e7eb',
                      background: editing.active ? '#f0fdf4' : '#fff',
                    }}
                  >
                    <span className="text-sm font-medium text-gray-700">Activo</span>
                    {editing.active
                      ? <ToggleRight size={22} style={{ color: '#2D6A4F' }} />
                      : <ToggleLeft size={22} className="text-gray-300" />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, featured: !editing.featured })}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: editing.featured ? ACCENT : '#e5e7eb',
                      background: editing.featured ? '#fff7ed' : '#fff',
                    }}
                  >
                    <span className="text-sm font-medium text-gray-700">Destacado</span>
                    <Star
                      size={18}
                      fill={editing.featured ? ACCENT : 'none'}
                      style={{ color: editing.featured ? ACCENT : '#d1d5db' }}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 py-3 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProduct}
                  disabled={saving || !editing.name || !editing.price}
                  className="flex-1 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: GREEN }}
                >
                  {saving ? 'Guardando...' : editing.id ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
