'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category } from '@/types/database'
import { ENVASE_UNITS, buildEnvaseUnit, splitEnvaseContent, resolvePresentation } from '@/lib/units'
import { Pencil, Plus, ToggleLeft, ToggleRight, Star, Search, X, Package, Image as ImageIcon, Upload, Check, AlertCircle } from 'lucide-react'

type Props = {
  initialProducts: Product[]
  categories: Category[]
}

const GREEN = '#1B2B1E'
const ACCENT = '#E8621A'
const UNIT_OPTIONS = ['kg', 'unid', 'ramo', 'bolsa', 'maceta', 'caja', 'paq', 'gr', 'malla', 'saco', 'atado'] as const
const CONTENT_OPTIONS = [
  { value: 'kg', label: 'kilos' },
  { value: 'gr', label: 'gramos' },
  { value: 'unid', label: 'unidades' },
] as const
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * Un envase (caja, malla, saco...) puede declarar cuánto trae adentro. Eso se
 * guarda en un solo string, 'caja 18kg', igual que los formatos que ya existían
 * en la base. Acá se parte en las tres piezas que muestra el formulario.
 * Ver src/lib/units.ts.
 */
function unitParts(unit: string | null | undefined): { key: string; qty: number | null; base: string } {
  const raw = (unit ?? '').trim()
  const contenido = splitEnvaseContent(raw)
  if (contenido) return { key: contenido.envase, qty: contenido.qty, base: contenido.base }
  return { key: raw, qty: null, base: 'kg' }
}

const esEnvase = (key: string) => ENVASE_UNITS.includes(key)

/** Mensaje para el caso en que PostgREST acepta el UPDATE pero no toca ninguna
 *  fila (RLS lo filtró en silencio). Ver migración 0006. */
const ERR_SIN_PERMISO =
  'No se pudo guardar: la base de datos rechazó el cambio. Cierra sesión, vuelve a entrar e inténtalo de nuevo.'


/**
 * Campo numérico que guarda al salir del foco (o con Enter) y muestra el
 * resultado real de la escritura: ✓ si guardó, ⚠ si la base lo rechazó.
 * Nada de "optimista y a rezar": si falla, el valor vuelve al anterior.
 */
function InlineNumber({
  value, onSave, prefix, allowEmpty = false, className = '', title,
}: {
  value: number | null
  onSave: (v: number | null) => Promise<{ ok: boolean; message?: string }>
  prefix?: string
  allowEmpty?: boolean
  className?: string
  title?: string
}) {
  const asText = value === null ? '' : String(value)
  const [draft, setDraft]   = useState(asText)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Si el valor cambia desde fuera (guardado del modal, recarga), refleja el nuevo.
  // Ajuste durante el render en vez de useEffect: así no pisa lo que el dueño
  // está tecleando ni provoca un render en cascada.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(asText)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function flash(next: 'saved' | 'error') {
    setStatus(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), next === 'saved' ? 1_500 : 4_000)
  }

  async function commit() {
    const raw = draft.trim()

    if (raw === '') {
      if (!allowEmpty) { setDraft(asText); return }
      if (value === null) return
      setStatus('saving')
      const r = await onSave(null)
      if (!r.ok) setDraft(String(value))
      flash(r.ok ? 'saved' : 'error')
      return
    }

    const parsed = Math.round(Number(raw))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(asText)
      return
    }
    if (parsed === value) { setDraft(String(parsed)); return }

    setStatus('saving')
    const r = await onSave(parsed)
    if (!r.ok) setDraft(asText)
    flash(r.ok ? 'saved' : 'error')
  }

  const border =
    status === 'error' ? '#dc2626' : status === 'saved' ? '#2D6A4F' : '#e5e7eb'

  return (
    <div className={`relative flex items-center ${className}`} title={title}>
      {prefix && <span className="text-gray-400 text-sm shrink-0 pl-2">{prefix}</span>}
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={status === 'saving'}
        placeholder={allowEmpty ? '—' : '0'}
        onFocus={e => e.currentTarget.select()}
        onChange={e => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(asText)
            e.currentTarget.blur()
          }
        }}
        className="w-full min-w-0 bg-transparent px-1.5 py-1 text-sm font-semibold text-gray-900 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
        style={{ borderColor: border }}
      />
      {status === 'saved' && <Check size={13} className="absolute -right-0.5 -top-1.5 text-emerald-600" />}
      {status === 'error' && <AlertCircle size={13} className="absolute -right-0.5 -top-1.5 text-red-600" />}
    </div>
  )
}

export default function ProductsAdminClient({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const supabase = createClient()

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const hidden = products.filter(p => !p.active).length

  function showToast(kind: 'ok' | 'error', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), kind === 'ok' ? 2_500 : 7_000)
  }

  function openEditor(p: Partial<Product>) { setModalError(null); setEditing(p) }
  function closeEditor()                    { setModalError(null); setEditing(null) }

  /**
   * Escribe un campo y CONFIRMA que la fila cambió de verdad.
   * PostgREST devuelve 200 con 0 filas cuando RLS bloquea el UPDATE, así que
   * pedimos las filas afectadas: si vuelven vacías, no se guardó nada.
   */
  async function patchProduct(
    id: string,
    patch: Partial<Product>,
  ): Promise<{ ok: boolean; message?: string }> {
    const before = products.find(p => p.id === id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))

    const { data, error } = await supabase
      .from('products').update(patch).eq('id', id).select('id')

    const failed = error ? error.message : (!data || data.length === 0) ? ERR_SIN_PERMISO : null
    if (failed) {
      console.error('[patchProduct] no se guardó:', { id, patch, error })
      if (before) setProducts(prev => prev.map(p => p.id === id ? before : p))
      showToast('error', failed)
      return { ok: false, message: failed }
    }
    return { ok: true }
  }

  const toggleActive   = (p: Product) => patchProduct(p.id, { active: !p.active })
  const toggleFeatured = (p: Product) => patchProduct(p.id, { featured: !p.featured })

  async function saveProduct() {
    if (!editing) return
    setSaving(true)
    setModalError(null)

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

    // `maybeSingle` en vez de `single`: si RLS filtra la fila no queremos un
    // error genérico de parseo, queremos saber que volvió vacío.
    const { data, error } = editing.id
      ? await supabase.from('products').update(payload).eq('id', editing.id)
          .select('*, category:categories(*)').maybeSingle()
      : await supabase.from('products').insert(payload)
          .select('*, category:categories(*)').maybeSingle()

    setSaving(false)

    if (error || !data) {
      // El modal NO se cierra: antes se cerraba igual y parecía que había
      // guardado, que es justo por lo que "no se podían modificar los precios".
      console.error('[saveProduct] no se guardó:', error)
      setModalError(error?.message ?? ERR_SIN_PERMISO)
      return
    }

    const saved = data as Product
    setProducts(prev => editing.id
      ? prev.map(p => p.id === saved.id ? saved : p)
      : [saved, ...prev])
    setEditing(null)
    showToast('ok', editing.id ? 'Cambios guardados' : 'Producto creado')
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

      {/* ── Aviso flotante del resultado real de la última escritura ── */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[60] max-w-[92vw] md:max-w-md flex items-start gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm text-white"
          style={{ backgroundColor: toast.kind === 'ok' ? '#2D6A4F' : '#b91c1c' }}
        >
          {toast.kind === 'ok'
            ? <Check size={16} className="shrink-0 mt-0.5" />
            : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: GREEN, fontFamily: 'var(--font-fraunces)' }}>
            Productos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} de {products.length} productos
            {hidden > 0 && <span className="text-gray-400"> · {hidden} ocultos del catálogo</span>}
          </p>
        </div>
        <button
          onClick={() => openEditor({ active: true, featured: false, unit: 'kg', stock: 0, images: [] })}
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
                  onClick={() => openEditor(product)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>

            {/* Precios + stock — los tres se editan aquí mismo: se escribe el
                número y al salir del campo (o con Enter) queda guardado. */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 rounded-xl px-2 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 pl-1.5">Precio</p>
                <InlineNumber
                  value={product.price}
                  prefix="$"
                  title="Precio minorista"
                  onSave={v => patchProduct(product.id, { price: v ?? 0 })}
                />
              </div>
              <div className="bg-gray-50 rounded-xl px-2 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 pl-1.5">Mayorista</p>
                <InlineNumber
                  value={product.price_wholesale}
                  prefix="$"
                  allowEmpty
                  title="Precio mayorista (vacío = sin precio mayorista)"
                  onSave={v => patchProduct(product.id, { price_wholesale: v })}
                />
              </div>
              <div className="bg-gray-50 rounded-xl px-2 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 pl-1.5">Stock</p>
                <InlineNumber
                  value={product.stock}
                  title="Stock disponible"
                  onSave={v => patchProduct(product.id, { stock: v ?? 0 })}
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
                <td className="px-4 py-3">
                  <InlineNumber
                    value={product.price}
                    prefix="$"
                    className="w-28 ml-auto"
                    title="Precio minorista"
                    onSave={v => patchProduct(product.id, { price: v ?? 0 })}
                  />
                </td>
                <td className="px-4 py-3">
                  <InlineNumber
                    value={product.price_wholesale}
                    prefix="$"
                    allowEmpty
                    className="w-28 ml-auto"
                    title="Precio mayorista (vacío = sin precio mayorista)"
                    onSave={v => patchProduct(product.id, { price_wholesale: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <InlineNumber
                    value={product.stock}
                    className="w-16 mx-auto"
                    title="Stock disponible"
                    onSave={v => patchProduct(product.id, { stock: v ?? 0 })}
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
                    onClick={() => openEditor(product)}
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
                  onClick={closeEditor}
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

                <PresentacionFields editing={editing} setEditing={setEditing} />

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

              {modalError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeEditor}
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

/**
 * Los campos que definen cuánto se lleva el cliente: cantidad + unidad y, cuando
 * la unidad es un envase (caja, malla, saco...), cuánto trae adentro.
 *
 * Sin el campo de contenido no había forma de declarar que una Caja Plátanos
 * trae 18 kg: se guardaba unit='caja' con unit_qty=18 y el catálogo mostraba
 * "18 cajas". Para envases el contenido reemplaza a la cantidad, y se guarda
 * como un solo string ('caja 18kg') igual que los formatos que ya venían en la
 * base. Ver src/lib/units.ts.
 */
function PresentacionFields({ editing, setEditing }: {
  editing: Partial<Product>
  setEditing: (next: Partial<Product>) => void
}) {
  const retail = unitParts(editing.unit)
  const mayorista = unitParts(editing.unit_wholesale)
  const retailEsEnvase = esEnvase(retail.key)
  const mayoristaEsEnvase = esEnvase(mayorista.key)

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200'
  const selectClass = `${inputClass} bg-white`
  const labelClass = 'text-xs font-medium text-gray-500 mb-1 block'

  const vistaPrevia = resolvePresentation({
    price: editing.price ?? 0,
    price_wholesale: editing.price_wholesale ?? null,
    unit: editing.unit || 'kg',
    unit_wholesale: editing.unit_wholesale ?? null,
    unit_qty: editing.unit_qty ?? 1,
    unit_qty_wholesale: editing.unit_qty_wholesale ?? null,
  })

  return (
    <>
      <div className={retailEsEnvase ? '' : 'grid grid-cols-[1fr_1fr] gap-3'}>
        {!retailEsEnvase && (
          <div>
            <label className={labelClass}>Cantidad minorista</label>
            <input
              type="number" min="0" step="any" className={inputClass} placeholder="1"
              value={editing.unit_qty ?? 1}
              onChange={e => setEditing({ ...editing, unit_qty: Number(e.target.value) || 1 })}
            />
          </div>
        )}
        <div>
          <label className={labelClass}>Unidad minorista</label>
          <select
            className={selectClass}
            value={retail.key || 'kg'}
            onChange={e => {
              const key = e.target.value
              setEditing({
                ...editing,
                unit: esEnvase(key) ? buildEnvaseUnit(key, retail.qty, retail.base) : key,
                ...(esEnvase(key) ? { unit_qty: 1 } : {}),
              })
            }}
          >
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {retailEsEnvase && (
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className={labelClass}>¿Cuánto trae?</label>
            <input
              type="number" min="0" step="any" className={inputClass} placeholder="— sin declarar —"
              value={retail.qty ?? ''}
              onChange={e => {
                const v = e.target.value
                setEditing({ ...editing, unit: buildEnvaseUnit(retail.key, v === '' ? null : Number(v), retail.base) })
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Medida del contenido</label>
            <select
              className={selectClass}
              value={retail.base}
              onChange={e => setEditing({ ...editing, unit: buildEnvaseUnit(retail.key, retail.qty, e.target.value) })}
            >
              {CONTENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className={mayoristaEsEnvase ? '' : 'grid grid-cols-[1fr_1fr] gap-3'}>
        {!mayoristaEsEnvase && (
          <div>
            <label className={labelClass}>Cantidad mayorista</label>
            <input
              type="number" min="0" step="any" className={inputClass} placeholder="— igual que minorista —"
              value={editing.unit_qty_wholesale ?? ''}
              onChange={e => {
                const v = e.target.value
                setEditing({ ...editing, unit_qty_wholesale: v === '' ? null : Number(v) })
              }}
            />
          </div>
        )}
        <div>
          <label className={labelClass}>Unidad mayorista</label>
          <select
            className={selectClass}
            value={mayorista.key}
            onChange={e => {
              const key = e.target.value
              if (!key) return setEditing({ ...editing, unit_wholesale: null })
              setEditing({
                ...editing,
                unit_wholesale: esEnvase(key) ? buildEnvaseUnit(key, mayorista.qty, mayorista.base) : key,
                ...(esEnvase(key) ? { unit_qty_wholesale: null } : {}),
              })
            }}
          >
            <option value="">— igual que minorista —</option>
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {mayoristaEsEnvase && (
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className={labelClass}>¿Cuánto trae? (mayorista)</label>
            <input
              type="number" min="0" step="any" className={inputClass} placeholder="— sin declarar —"
              value={mayorista.qty ?? ''}
              onChange={e => {
                const v = e.target.value
                setEditing({ ...editing, unit_wholesale: buildEnvaseUnit(mayorista.key, v === '' ? null : Number(v), mayorista.base) })
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Medida del contenido</label>
            <select
              className={selectClass}
              value={mayorista.base}
              onChange={e => setEditing({ ...editing, unit_wholesale: buildEnvaseUnit(mayorista.key, mayorista.qty, e.target.value) })}
            >
              {CONTENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
        <p className="text-[11px] font-medium text-emerald-800">Así lo verá el cliente</p>
        <p className="text-sm text-emerald-900">
          {vistaPrevia.label}
          {vistaPrevia.perMeasure && <span className="text-emerald-700"> · {vistaPrevia.perMeasure}</span>}
        </p>
      </div>
    </>
  )
}
