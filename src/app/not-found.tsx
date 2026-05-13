import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: '24px',
      background: '#FBF9F3', color: '#1B2B1E',
    }}>
      <span style={{ fontSize: 48, marginBottom: 16 }}>🥬</span>
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#52B788', margin: '0 0 8px' }}>
        Error 404
      </p>
      <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
        Página no encontrada
      </h1>
      <p style={{ color: '#6B7A6F', marginBottom: 28, textAlign: 'center', maxWidth: 340 }}>
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/"
        style={{
          height: 44, padding: '0 28px', borderRadius: 100,
          background: '#2D6A4F', color: '#fff', fontWeight: 600,
          fontSize: 14, display: 'inline-flex', alignItems: 'center',
          textDecoration: 'none',
        }}
      >
        Volver al inicio
      </Link>
    </div>
  )
}
