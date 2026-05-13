'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Lock, ShieldCheck } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import OrderSummary from './OrderSummary'
import type { Zone, UserRole } from '@/types/database'

type Props = {
  zones: Zone[]
  userRole: UserRole
  userEmail: string | null
  initialName: string | null
  initialPhone: string | null
  initialAddress: string | null
}

export default function CheckoutClient({
  zones,
  userRole,
  userEmail,
  initialName,
  initialPhone,
  initialAddress,
}: Props) {
  const router = useRouter()
  const items = useCart(s => s.items)
  const total = useCart(s => s.total)
  const clearCart = useCart(s => s.clearCart)

  // Hydration safety: solo confiamos en useCart después del mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Comuna seleccionada → encontramos la zone que la contiene.
  const allCommunes = useMemo(() => {
    const set = new Set<string>()
    zones.forEach(z => z.communes.forEach(c => set.add(c)))
    return Array.from(set).sort()
  }, [zones])

  const [name, setName] = useState(initialName ?? '')
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [address, setAddress] = useState(initialAddress ?? '')
  const [commune, setCommune] = useState(allCommunes[0] ?? '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedZone = useMemo(
    () => zones.find(z => z.communes.includes(commune)) ?? null,
    [zones, commune]
  )

  if (mounted && items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-3">
        <p className="text-5xl">🛒</p>
        <p className="text-gray-700 font-semibold">Tu carrito está vacío</p>
        <p className="text-sm text-gray-500">Vuelve al catálogo y agrega productos para finalizar tu pedido.</p>
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: '#1B2B1E' }}
        >
          Ir al catálogo
        </Link>
      </div>
    )
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ product_id: i.product.id, qty: i.qty })),
          address: address.trim(),
          commune,
          phone: phone.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo iniciar el pago.')
      }

      // Vaciamos el carrito antes de redirigir — si el usuario cancela el pago,
      // siempre puede repetir el flujo desde /catalogo.
      clearCart()

      // Construimos un form que postea token_ws a la URL de Transbank.
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.url
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'token_ws'
      input.value = data.token
      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Datos de contacto</h2>
          <Field label="Nombre" required value={name} onChange={setName} placeholder="Tu nombre o razón social" />
          <Field label="Teléfono" required type="tel" value={phone} onChange={setPhone} placeholder="+56 9 1234 5678" />
          {userEmail && (
            <p className="text-xs text-gray-500">
              Confirmaciones a <strong>{userEmail}</strong>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Dirección de despacho</h2>
          <Field
            label="Calle, número, depto"
            required
            value={address}
            onChange={setAddress}
            placeholder="Av. Macul 4321, depto 12B"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comuna</label>
            <select
              required
              value={commune}
              onChange={e => setCommune(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
            >
              {allCommunes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {selectedZone && (
              <p className="text-xs text-gray-500 mt-1">
                Zona <strong>{selectedZone.name}</strong> · despacho {formatPrice(selectedZone.delivery_price)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Ej: dejar con conserje, tocar timbre, sin cilantro…"
            />
          </div>
        </section>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
          <button
            type="submit"
            disabled={loading || !mounted}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: '#1B2B1E' }}
          >
            {loading ? (
              <>Iniciando pago…</>
            ) : mounted ? (
              <>
                <CreditCard size={16} /> Pagar {formatPrice(total() + (selectedZone?.delivery_price ?? 0))} con Webpay
              </>
            ) : (
              <>Cargando carrito…</>
            )}
          </button>

          <p className="text-[11px] text-gray-500 inline-flex items-center justify-center gap-1.5">
            <Lock size={12} /> Pago seguro · <ShieldCheck size={12} /> Webpay Plus de Transbank
          </p>
        </div>
      </form>

      <OrderSummary zone={selectedZone} userRole={userRole} />
    </div>
  )
}

function Field({
  label,
  required = false,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string
  required?: boolean
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      />
    </div>
  )
}
