'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegistroMayoristaPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    phoneRaw: '',  // solo la parte después de +56
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

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
          phone: '+56' + form.phoneRaw.replace(/\s/g, ''),
          role: 'mayorista',
        },
      },
    })

    if (authError) {
      setError(traducirError(authError.message))
      setLoading(false)
      return
    }

    // Notificar a Celso en segundo plano (no bloqueante)
    fetch('/api/notify/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: '+56' + form.phoneRaw.replace(/\s/g, ''),
        tipo: 'mayorista',
      }),
    }).catch(() => {
      // No crítico — si falla la notificación, el registro igual fue exitoso
    })

    if (!data.session) {
      // Supabase requiere confirmación de correo
      setNeedsConfirmation(true)
      setLoading(false)
      return
    }

    // Sesión activa (confirmación de email desactivada) → directo al catálogo mayorista
    router.push('/mayorista')
    router.refresh()
  }

  async function handleResend() {
    setResending(true)
    setResendMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: form.email,
    })
    if (error) {
      setResendMsg('No se pudo reenviar. Intenta en unos minutos.')
    } else {
      setResendMsg('✅ Correo reenviado. Revisa también tu carpeta de spam.')
    }
    setResending(false)
  }

  // ─── Pantalla de confirmación de email ───────────────────────
  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="text-5xl mb-4">📬</div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              Revisa tu correo
            </h1>
            <p className="text-gray-600 mb-2">
              Te enviamos un mail a{' '}
              <strong className="text-gray-800">{form.email}</strong>.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Haz clic en el enlace del correo para activar tu cuenta. Una vez
              confirmado tendrás acceso inmediato a los precios mayoristas.
            </p>

            {/* Resend */}
            {resendMsg ? (
              <p className="text-sm text-emerald-700 mb-4">{resendMsg}</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-emerald-700 underline underline-offset-2 disabled:opacity-50 mb-4 block mx-auto"
              >
                {resending ? 'Reenviando…' : '¿No llegó? Reenviar correo'}
              </button>
            )}

            <p className="text-xs text-gray-400 mb-6">
              Revisa también la carpeta de{' '}
              <span className="font-medium">correo no deseado / spam</span>.
            </p>

            <Link
              href="/mayorista/login"
              className="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--green-dark, #1B2B1E)' }}
            >
              Ir a ingresar →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── Formulario de registro ───────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl mb-4">
            <span>🥦</span>
            <span className="font-bold" style={{ color: 'var(--green-dark)' }}>
              El Menú
            </span>
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
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
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Teléfono de contacto
            </label>
            <div className="flex rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent overflow-hidden">
              <span className="flex items-center px-3 bg-gray-50 border-r border-gray-300 text-sm text-gray-600 font-medium select-none">
                +56
              </span>
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                value={form.phoneRaw}
                onChange={e => update('phoneRaw', e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                placeholder="9 1234 5678"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
          <Link
            href="/mayorista/login"
            className="font-semibold text-emerald-700 hover:underline"
          >
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
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
  }
  return msg
}
