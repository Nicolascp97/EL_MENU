import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { generateAndSaveRecipes } from '@/lib/generateRecipes'

export const maxDuration = 60

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (!cronSecret) {
    console.error('CRON_SECRET no está configurado')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  let cronValid = false
  try {
    const recv = Buffer.from(auth)
    cronValid = recv.length === expected.length && timingSafeEqual(recv, expected)
  } catch { cronValid = false }
  if (!cronValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateAndSaveRecipes()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, generated: result.generated })
}
