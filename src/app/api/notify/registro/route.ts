import { NextResponse } from 'next/server'

/**
 * POST /api/notify/registro
 *
 * Notifica a Celso vía WhatsApp (CallMeBot) cada vez que
 * una empresa o persona nueva se registra en El Menú.
 * Le permite agregarlos manualmente a su CRM.
 *
 * Body esperado:
 * {
 *   name: string
 *   email: string
 *   phone: string
 *   tipo: 'mayorista' | 'minorista'
 * }
 */
export async function POST(req: Request) {
  try {
    const { name, email, phone, tipo } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    await notifyWhatsApp({ name, email, phone, tipo })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify/registro] Error:', err)
    // No bloqueamos el registro si la notificación falla
    return NextResponse.json({ ok: false, error: 'Notificación fallida (no crítico)' }, { status: 200 })
  }
}

async function notifyWhatsApp({
  name,
  email,
  phone,
  tipo,
}: {
  name: string
  email: string
  phone: string
  tipo: string
}) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  const waPhone = process.env.NEXT_PUBLIC_WA_NUMBER
  if (!apiKey || !waPhone) {
    // Si CallMeBot no está activado aún, sólo logueamos
    console.log('[notify/registro] CallMeBot no configurado. Registro recibido:', { name, email, phone, tipo })
    return
  }

  const emoji = tipo === 'mayorista' ? '🏢' : '🛒'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.el-menu.cl'

  const msg = tipo === 'mayorista'
    ? [
        `🏢 NUEVA SOLICITUD MAYORISTA`,
        ``,
        `👤 ${name}`,
        `📧 ${email}`,
        `📱 ${phone || 'No indicado'}`,
        ``,
        `→ Aprobar o rechazar en:`,
        `${appUrl}/admin/mayoristas`,
      ].join('\n')
    : [
        `🛒 NUEVO REGISTRO El Menú`,
        ``,
        `👤 ${name}`,
        `📧 ${email}`,
        `📱 ${phone || 'No indicado'}`,
        `🏷️ Tipo: Minorista`,
      ].join('\n')

  const url = `https://api.callmebot.com/whatsapp.php?phone=${waPhone}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
