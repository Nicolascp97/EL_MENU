/**
 * POST/GET /api/suscripcion/confirmar?secret=...
 *
 * Confirmación MANUAL del pago, protegida por un secreto que solo conoce Nicolás
 * (SUBSCRIPTION_CONFIRM_SECRET). Cuando Mercado Pago le avisa que el cliente pagó,
 * Nicolás abre esta URL y el vencimiento se corre al mes siguiente → el aviso del
 * panel desaparece solo.
 *
 * Es la ÚNICA vía para reiniciar el ciclo: el panel es del cliente, así que él no
 * puede auto-marcarse pagado.
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { markPaid } from '@/lib/subscription'

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

async function handle(req: Request) {
  const secret = process.env.SUBSCRIPTION_CONFIRM_SECRET ?? ''
  if (!secret) {
    console.error('SUBSCRIPTION_CONFIRM_SECRET no está configurado')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const provided = new URL(req.url).searchParams.get('secret') ?? ''
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await markPaid()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    message: `Pago confirmado. Próximo vencimiento: ${result.nextDueDate}`,
    nextDueDate: result.nextDueDate,
  })
}

export const GET = handle
export const POST = handle
