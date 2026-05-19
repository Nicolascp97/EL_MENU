import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndSaveRecipes } from '@/lib/generateRecipes'

export async function POST() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await generateAndSaveRecipes()
  return NextResponse.json(result)
}
