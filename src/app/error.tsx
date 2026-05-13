'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: '24px',
      background: '#FBF9F3', color: '#1B2B1E',
    }}>
      <span style={{ fontSize: 48, marginBottom: 16 }}>🥦</span>
      <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>
        Algo salió mal
      </h1>
      <p style={{ color: '#6B7A6F', marginBottom: 28, textAlign: 'center', maxWidth: 360 }}>
        Ocurrió un error inesperado. Puedes intentarlo nuevamente o volver al inicio.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            height: 44, padding: '0 24px', borderRadius: 100, border: 0,
            background: '#2D6A4F', color: '#fff', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Intentar nuevamente
        </button>
        <Link
          href="/"
          style={{
            height: 44, padding: '0 24px', borderRadius: 100,
            border: '1px solid #CDD5CF', background: 'transparent',
            color: '#1B2B1E', fontWeight: 600, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
