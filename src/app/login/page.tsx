'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginAdminPage() {
  const router = useRouter()
  const [next, setNext] = useState('/admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const target = params.get('next')
    if (target && target.startsWith('/') && !target.startsWith('//')) {
      setNext(target)
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError) {
      setError(traducirError(authError.message))
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#1B2B1E' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl mb-4">
            <span>🥦</span>
            <span
              className="font-bold text-white"
              style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}
            >
              El Menú
            </span>
          </Link>
          <h1
            className="text-xl font-bold text-white"
            style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}
          >
            Panel de administración
          </h1>
          <p className="text-sm mt-1" style={{ color: '#A8C5A0' }}>
            Acceso exclusivo para el equipo interno.
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border p-6 space-y-4"
          style={{ background: '#243B28', borderColor: '#2E4A32' }}
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: '#D4EAD0' }}>
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: '#1B2B1E',
                border: '1px solid #2E4A32',
                color: 'white',
              }}
              placeholder="admin@elmenu.cl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: '#D4EAD0' }}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: '#1B2B1E',
                border: '1px solid #2E4A32',
                color: 'white',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: '#4A7C59' }}
          >
            {loading ? 'Ingresando…' : 'Ingresar al panel'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#5A7A5E' }}>
          ¿Eres cliente?{' '}
          <Link href="/mayorista/login" className="hover:underline" style={{ color: '#A8C5A0' }}>
            Acceso mayoristas →
          </Link>
        </p>
      </div>
    </div>
  )
}

function traducirError(msg: string): string {
  if (msg.toLowerCase().includes('invalid login')) return 'Correo o contraseña incorrectos.'
  if (msg.toLowerCase().includes('email not confirmed'))
    return 'El correo no está confirmado. Revisa tu bandeja de entrada.'
  return msg
}
