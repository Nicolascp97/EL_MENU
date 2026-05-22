import { NextRequest, NextResponse } from 'next/server'

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  if (!origin) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null

  try {
    const originUrl = new URL(origin)
    const appHost = new URL(appUrl).host

    // Mismo host configurado → OK
    if (originUrl.host === appHost) return null

    // Cualquier variante de localhost es válida en desarrollo
    if (LOCALHOST_HOSTS.has(originUrl.hostname)) return null

    // URL de preview de Vercel (VERCEL_URL no incluye protocolo)
    const vercelHost = process.env.VERCEL_URL
    if (vercelHost && originUrl.host === vercelHost) return null

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
