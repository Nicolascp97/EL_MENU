'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegistroMayoristaPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          phone: form.phone,
          role: 'minorista',
          mayorista_requested: true,
        },
      },
    })
    if (authError) {
      setError(traducirError(authError.message))
      setLoading(false)
      return
    }
    if (!data.session) {
      setNeedsConfirmation(true)
      setLoading(false)
      return
    }
    router.push('/mayorista')
    router.refresh()
  }

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Revisa tu correo
          </h1>
          <p className="text-gray-600 mb-6">
            Te enviamos un mail a <strong>{form.email}</strong> para confirmar tu cuenta. Una vez
            confirmado, el equipo de El Menú revisará tu solicitud y activará tu acceso mayorista en 24-48 horas.
          </p>
          <Link
            href="/mayorista/login"
            className="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--green-dark, #1B2B1E)' }}
          >
            Ir a ingresar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl mb-4">
            <span>🥦</span>
            <span className="font-bold" style={{ color: 'var(--green-dark)' }}>El Menú</span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Crear cuenta mayorista
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Acceso a precios mayoristas, facturación y crédito a 30 días.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre o razón social
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Restaurante La Esquina SpA"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono de contacto
            </label>
            <input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="+56 9 1234 5678"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="contacto@miempresa.cl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'var(--green-dark, #1B2B1E)' }}
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Al registrarte aceptás recibir comunicaciones sobre tu cuenta y pedidos.
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/mayorista/login" className="font-semibold text-emerald-700 hover:underline">
            Ingresa
          </Link>
        </p>
      </div>
    </div>
  )
}

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('already registered') || m.includes('user already')) {
    return 'Ya hay una cuenta con ese correo. Probá ingresando.'
  }
  if (m.includes('password') && m.includes('characters')) {
    return 'La contraseña tiene que tener al menos 8 caracteres.'
  }
  if (m.includes('email')) return 'El correo no es válido.'
  return msg
}
