'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Lock, ShieldCheck, Banknote, MessageCircle } from 'lucide-react'
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

const ORANGE = '#E8621A'
const ORANGE_DK = '#C44F0E'

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

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const allCommunes = useMemo(() => {
    const set = new Set<string>()
    zones.forEach(z => z.communes.forEach(c => set.add(c)))
    return Array.from(set).sort()
  }, [zones])

  const [name, setName]       = useState(initialName ?? '')
  const [phone, setPhone]     = useState(initialPhone ?? '')
  const [address, setAddress] = useState(initialAddress ?? '')
  const [commune, setCommune] = useState(allCommunes[0] ?? '')
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'webpay' | 'transfer'>('webpay')

  const selectedZone = useMemo(
    () => zones.find(z => z.communes.includes(commune)) ?? null,
    [zones, commune]
  )

  const grandTotal = mounted ? total() + (selectedZone?.delivery_price ?? 0) : 0

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
      if (paymentMethod === 'transfer') {
        const res = await fetch('/api/checkout/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({ product_id: i.product.id, qty: i.qty })),
            address: address.trim(),
            commune,
            phone: phone.trim(),
            name: name.trim(),
            notes: notes.trim() || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'No se pudo registrar el pedido.')
        clearCart()
        router.push(`/checkout/confirmacion?status=transfer&orderId=${data.orderId}`)
        return
      }

      // Webpay flow
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
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo iniciar el pago.')

      clearCart()

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

        {/* ── Método de pago ── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Método de pago</h2>
          <div className="grid grid-cols-2 gap-3">
            <PayMethodCard
              selected={paymentMethod === 'webpay'}
              onClick={() => setPaymentMethod('webpay')}
              icon={<CreditCard size={20} />}
              label="Webpay / Tarjeta"
              sublabel="Débito, crédito y prepago"
            />
            <PayMethodCard
              selected={paymentMethod === 'transfer'}
              onClick={() => setPaymentMethod('transfer')}
              icon={<Banknote size={20} />}
              label="Transferencia"
              sublabel="Datos bancarios al confirmar"
            />
          </div>

          {paymentMethod === 'transfer' && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3 text-sm">
              <p className="font-semibold text-orange-900">Datos para la transferencia</p>
              <dl className="space-y-1 text-gray-700">
                <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">Banco</dt><dd>Banco de Chile</dd></div>
                <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">Tipo de cuenta</dt><dd>Cuenta Corriente</dd></div>
                {/* TODO: Celso debe completar estos datos */}
                <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">N° de cuenta</dt><dd className="font-mono">— Consultar a Celso —</dd></div>
                <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">RUT titular</dt><dd className="font-mono">— Consultar a Celso —</dd></div>
                <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">Nombre</dt><dd>El Menú SpA</dd></div>
                <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">Email</dt><dd>— Consultar a Celso —</dd></div>
                {mounted && (
                  <div className="flex gap-2 pt-1 border-t border-orange-200">
                    <dt className="text-gray-500 w-28 shrink-0">Monto</dt>
                    <dd className="font-bold text-orange-900">{formatPrice(grandTotal)}</dd>
                  </div>
                )}
                {name && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-28 shrink-0">Asunto</dt>
                    <dd>Pedido {name}</dd>
                  </div>
                )}
              </dl>
              <div className="flex items-start gap-2 text-orange-800 bg-orange-100 rounded-lg p-3">
                <MessageCircle size={16} className="shrink-0 mt-0.5" />
                <p>Una vez realizada la transferencia, envía el comprobante por WhatsApp al <strong>+56 9 5495 2395</strong> para confirmar tu pedido.</p>
              </div>
            </div>
          )}
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
            className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: loading ? ORANGE_DK : ORANGE }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = ORANGE_DK }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = ORANGE }}
          >
            {loading ? (
              <>Procesando…</>
            ) : !mounted ? (
              <>Cargando carrito…</>
            ) : paymentMethod === 'webpay' ? (
              <><CreditCard size={16} /> Pagar {formatPrice(grandTotal)} con Webpay</>
            ) : (
              <><Banknote size={16} /> Confirmar pedido · {formatPrice(grandTotal)}</>
            )}
          </button>

          <p className="text-[11px] text-gray-500 inline-flex items-center justify-center gap-1.5">
            {paymentMethod === 'webpay'
              ? <><Lock size={12} /> Pago seguro · <ShieldCheck size={12} /> Webpay Plus de Transbank</>
              : <><Lock size={12} /> Pedido seguro · Tu información está protegida</>
            }
          </p>
        </div>
      </form>

      <OrderSummary zone={selectedZone} userRole={userRole} />
    </div>
  )
}

function PayMethodCard({
  selected,
  onClick,
  icon,
  label,
  sublabel,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sublabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all cursor-pointer"
      style={{
        borderColor: selected ? ORANGE : '#E5E7EB',
        background: selected ? '#FDE8D8' : '#fff',
      }}
    >
      <span style={{ color: selected ? ORANGE : '#6B7280' }}>{icon}</span>
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <span className="text-xs text-gray-500">{sublabel}</span>
    </button>
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
