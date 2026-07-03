/**
 * subscription.ts — Estado de cobro de la suscripción mensual
 *
 * Single-tenant: una fila (id = 1) en la tabla `subscription` guarda el próximo
 * vencimiento y el monto. El estado (active/grace/overdue) NO se guarda: se deriva
 * en vivo de next_due_date cada vez que el dueño abre el panel de admin.
 *
 * Toda lectura/escritura usa el admin client (service role), que bypassa RLS.
 * El cálculo de días se hace en zona horaria de Chile (America/Santiago), no UTC.
 */

import { createAdminClient } from './supabase/admin'

export type SubscriptionState = 'active' | 'grace' | 'overdue'

export interface SubscriptionInfo {
  nextDueDate:  string          // 'YYYY-MM-DD' — vencimiento del período impago más antiguo
  amountClp:    number          // valor de UN mes
  state:        SubscriptionState
  daysUntilDue: number          // >0 faltan días · 0 vence hoy · <0 vencido
  monthsOwed:   number          // meses acumulados sin pagar (0 si está al día)
  amountOwed:   number          // monthsOwed * amountClp (deuda total acumulada)
}

// 'YYYY-MM-DD' del día de hoy en Chile.
function todayInSantiago(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Días de calendario entre dos fechas 'YYYY-MM-DD' (toISO - fromISO).
function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00Z`).getTime()
  const b = new Date(`${toISO}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * Deriva el estado a partir del vencimiento:
 *   daysUntilDue >= 0  → active  (aún no vence / vence hoy)
 *   -1 a -5            → grace   (vencido, la app sigue viva)
 *   <= -6             → overdue (modal insistente)
 */
export function computeStatus(nextDueDate: string): {
  state: SubscriptionState
  daysUntilDue: number
} {
  const daysUntilDue = daysBetween(todayInSantiago(), nextDueDate)
  const state: SubscriptionState =
    daysUntilDue >= 0 ? 'active' : daysUntilDue >= -5 ? 'grace' : 'overdue'
  return { state, daysUntilDue }
}

/**
 * Meses de suscripción acumulados sin pagar. Como el vencimiento cae siempre el
 * día 1, contamos los períodos mensuales transcurridos desde nextDueDate hasta hoy.
 *   due=jul, hoy=jul → 1 (debe julio) · hoy=ago → 2 (julio+agosto) · etc.
 *   hoy anterior al vencimiento → 0 (aún no debe nada).
 */
export function computeMonthsOwed(nextDueDate: string): number {
  const [dueY, dueM] = nextDueDate.split('-').map(Number)
  const [todY, todM] = todayInSantiago().split('-').map(Number)
  const diff = (todY * 12 + todM) - (dueY * 12 + dueM) + 1
  return Math.max(0, diff)
}

/** Lee la suscripción. Devuelve null si no existe o hay error (el layout hace fail-open). */
export async function getSubscription(): Promise<SubscriptionInfo | null> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('subscription')
    .select('next_due_date, amount_clp')
    .eq('id', 1)
    .single()

  if (error || !data) return null

  const { state, daysUntilDue } = computeStatus(data.next_due_date)
  const monthsOwed = computeMonthsOwed(data.next_due_date)
  return {
    nextDueDate:  data.next_due_date,
    amountClp:    data.amount_clp,
    state,
    daysUntilDue,
    monthsOwed,
    amountOwed:   monthsOwed * data.amount_clp,
  }
}

/**
 * Confirma el pago: mueve el vencimiento al día 1 del mes siguiente al vencimiento
 * ACTUAL (día de cobro fijo, corre desde la fecha establecida — no desde la fecha de
 * pago) y registra last_paid_at. Solo se invoca desde el endpoint protegido por
 * SUBSCRIPTION_CONFIRM_SECRET (nadie más puede reiniciar el ciclo).
 */
export async function markPaid(): Promise<{
  ok: boolean
  nextDueDate?: string
  error?: string
}> {
  const sb = createAdminClient()

  const { data, error } = await sb
    .from('subscription')
    .select('next_due_date')
    .eq('id', 1)
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'no existe la fila de suscripción' }

  const [y, m] = (data.next_due_date as string).split('-').map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear  = m === 12 ? y + 1 : y
  const next = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const { error: upErr } = await sb
    .from('subscription')
    .update({ next_due_date: next, last_paid_at: new Date().toISOString() })
    .eq('id', 1)

  if (upErr) return { ok: false, error: upErr.message }
  return { ok: true, nextDueDate: next }
}
