import { NextResponse } from 'next/server'
import { notifyRegistroMayorista } from '@/lib/notify'

/**
 * POST /api/notify/registro
 * Notifica a Celso cuando llega un nuevo registro mayorista.
 */
export async function POST(req: Request) {
  try {
    const { name, email, phone, tipo } = await req.json()
    if (!name || !email) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    if (tipo === 'mayorista') {
      await notifyRegistroMayorista({ name, email, phone })
    }
    // Registros minoristas no generan notificación (solo mayoristas son relevantes)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify/registro] Error:', err)
    return NextResponse.json({ ok: false }, { status: 200 }) // no bloquear el registro
  }
}
