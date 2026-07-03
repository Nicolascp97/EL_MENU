'use client'
/**
 * SubscriptionNotice — Aviso de cobro de la suscripción, visible SOLO en el panel admin.
 *
 * Escala con los días (ver src/lib/subscription.ts):
 *   active (>5 días)  → banner suave, cerrable
 *   active (−5..−1)   → banner ámbar, cerrable
 *   active (día 0)    → banner naranjo, NO cerrable
 *   grace (+1..+5)    → banner naranjo fijo, NO cerrable
 *   overdue (≥+6)     → banner ROJO permanente (no cerrable) + modal que reaparece
 *                        cada 5 min aunque le den "Pagar después"
 *
 * NO afecta al menú público ni al comensal: vive dentro de /admin.
 */
import { useState, useEffect, useRef } from 'react'
import { CreditCard, AlertTriangle, Clock, X } from 'lucide-react'
import type { SubscriptionState } from '@/lib/subscription'

const clp = (n: number) => '$' + n.toLocaleString('es-CL')

// Cada cuánto vuelve a aparecer el modal tras "Pagar después".
const REMINDER_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

function dueLabel(nextDueDate: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(`${nextDueDate}T00:00:00Z`))
}

export default function SubscriptionNotice({
  state,
  daysUntilDue,
  amount,
  nextDueDate,
  payLink,
  monthsOwed,
  amountOwed,
}: {
  state: SubscriptionState
  daysUntilDue: number
  amount: number
  nextDueDate: string
  payLink: string
  monthsOwed: number
  amountOwed: number
}) {
  // Hooks SIEMPRE al tope (antes de cualquier return), para no romper las reglas de hooks.
  const [bannerDismissed, setBannerDismissed] = useState(false) // solo banners suaves cerrables
  const [modalOpen, setModalOpen] = useState(true)              // modal del estado vencido
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Limpia el temporizador al desmontar.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const overdueDays = Math.abs(daysUntilDue)
  const multiMonth = monthsOwed >= 2

  // "Pagar después": esconde el modal y lo reprograma en 5 min (insiste hasta que pague).
  function snoozeModal() {
    setModalOpen(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setModalOpen(true), REMINDER_INTERVAL_MS)
  }

  const debtLabel = multiMonth
    ? `${monthsOwed} meses pendientes (${clp(amountOwed)})`
    : `vencido hace ${overdueDays} día${overdueDays !== 1 ? 's' : ''}`

  // ─── OVERDUE (≥+6): banner rojo PERMANENTE + modal cada 5 min ─────────────
  if (state === 'overdue') {
    return (
      <>
        {/* Banner rojo permanente — no se puede cerrar, se queda hasta que pague. */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', margin: '12px 16px 0', borderRadius: 12,
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
          }}
        >
          <span style={{ flexShrink: 0, display: 'flex' }}><AlertTriangle size={18} /></span>
          <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45 }}>
            💳 Tu plan está <strong>{debtLabel}</strong>. Regulariza tu pago para no perder el servicio.
          </span>
          <a
            href={payLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 8,
              background: '#991B1B', color: '#fff', fontWeight: 600, fontSize: 13,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Pagar ahora
          </a>
        </div>

        {/* Modal insistente — reaparece cada 5 min tras "Pagar después". */}
        {modalOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(20,30,22,.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div
              style={{
                background: '#fff', borderRadius: 16, maxWidth: 400, width: '100%',
                padding: '28px 24px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.3)',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <AlertTriangle size={28} color="#DC2626" strokeWidth={2.2} />
              </div>
              <h2 style={{
                fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 20,
                color: '#1B2B1E', margin: '0 0 8px',
              }}>
                {multiMonth ? 'Tienes pagos pendientes' : 'Tu plan está vencido'}
              </h2>
              <p style={{ color: '#4B5563', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
                {multiMonth ? (
                  <>Tienes <strong>{monthsOwed} meses pendientes</strong> de pago
                  (<strong>{clp(amountOwed)}</strong> en total). Regulariza tu suscripción para
                  no perder el servicio.</>
                ) : (
                  <>Han pasado <strong>{overdueDays} días</strong> desde el vencimiento. Para evitar
                  la suspensión del servicio, regulariza tu pago de <strong>{clp(amount)}</strong> ahora.</>
                )}
              </p>
              <a
                href={payLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '13px 0', borderRadius: 10, background: '#DC2626',
                  color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                }}
              >
                <CreditCard size={18} /> Pagar {clp(amount)}{multiMonth ? ' / mes' : ''}
              </a>
              {multiMonth && (
                <p style={{ color: '#9CA3AF', fontSize: 11.5, lineHeight: 1.5, margin: '10px 0 0' }}>
                  El pago es de {clp(amount)} por mes. Repite el pago por cada mes pendiente.
                </p>
              )}
              <button
                onClick={snoozeModal}
                style={{
                  marginTop: 12, background: 'transparent', border: 'none',
                  color: '#9CA3AF', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Pagar después
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ─── Banners (active / grace) ─────────────────────────────────────────────
  let bg = '#ECFDF5', border = '#A7F3D0', fg = '#065F46', icon = <CreditCard size={18} />
  let text: React.ReactNode
  let closable = true

  if (state === 'grace') {
    // Naranjo (aún no rojo): venció pero está dentro de los 5 días de gracia.
    bg = '#FFF7ED'; border = '#FDBA74'; fg = '#9A3412'; closable = false
    icon = <AlertTriangle size={18} />
    text = <>Tu plan está <strong>vencido hace {overdueDays} día{overdueDays !== 1 ? 's' : ''}</strong>. Regulariza los {clp(amount)} antes de que se suspenda el servicio.</>
  } else if (daysUntilDue === 0) {
    bg = '#FFF7ED'; border = '#FDBA74'; fg = '#9A3412'; closable = false
    icon = <Clock size={18} />
    text = <>Tu plan <strong>vence hoy</strong>. Paga {clp(amount)} para mantener El Menú activo.</>
  } else if (daysUntilDue <= 5) {
    bg = '#FFFBEB'; border = '#FCD34D'; fg = '#92400E'
    text = <>Tu plan vence en <strong>{daysUntilDue} día{daysUntilDue !== 1 ? 's' : ''}</strong>. Paga los {clp(amount)} y sigue sin interrupciones.</>
  } else {
    text = <>Tu plan de El Menú ({clp(amount)}) vence el <strong>{dueLabel(nextDueDate)}</strong>. Puedes pagar cuando quieras.</>
  }

  if (closable && bannerDismissed) return null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', margin: '12px 16px 0', borderRadius: 12,
        background: bg, border: `1px solid ${border}`, color: fg,
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45 }}>💳 {text}</span>
      <a
        href={payLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flexShrink: 0, padding: '7px 14px', borderRadius: 8,
          background: fg, color: '#fff', fontWeight: 600, fontSize: 13,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}
      >
        {state === 'grace' || daysUntilDue === 0 ? 'Pagar ahora' : 'Pagar'}
      </a>
      {closable && (
        <button
          onClick={() => setBannerDismissed(true)}
          aria-label="Cerrar"
          style={{ flexShrink: 0, background: 'transparent', border: 'none', color: fg, opacity: .6, cursor: 'pointer', display: 'flex', padding: 2 }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
