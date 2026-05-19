import { NextRequest, NextResponse } from 'next/server'

export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null

  if (!origin) return null

  try {
    const originHost = new URL(origin).host
    const appHost = new URL(appUrl).host
    if (originHost !== appHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
