import { NextResponse, after } from 'next/server'
import { notifyRegistroMayorista } from '@/lib/notify'

// El aviso a n8n corre en `after()`, con hasta 3 intentos (≈24s en el peor caso).
export const maxDuration = 30

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

    // Fuera del ciclo de respuesta: el usuario que se registra no tiene por qué
    // esperar a que n8n conteste, pero el aviso sí debe completarse.
    if (tipo === 'mayorista') {
      after(() => notifyRegistroMayorista({ name, email, phone }))
    }
    // Registros minoristas no generan notificación (solo mayoristas son relevantes)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify/registro] Error:', err)
    return NextResponse.json({ ok: false }, { status: 200 }) // no bloquear el registro
  }
}
