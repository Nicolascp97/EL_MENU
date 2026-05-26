import { NextRequest, NextResponse } from 'next/server'

/**
 * Modo mantenimiento — actívalo con MAINTENANCE_MODE=true en Vercel
 * Devuelve 503 a todos los visitantes mientras el flag esté activo.
 */
export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== 'true') {
    return NextResponse.next()
  }

  // Las API routes devuelven JSON
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Sitio en mantenimiento. Vuelve pronto.' },
      { status: 503, headers: { 'Retry-After': '3600' } }
    )
  }

  // El resto devuelve HTML
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>El Menú — En mantenimiento</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100svh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0fdf4;
      padding: 1rem;
    }
    .card {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .emoji { font-size: 3.5rem; display: block; margin-bottom: 1.25rem; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #1B2B1E; margin-bottom: 0.5rem; }
    p { color: #4B5563; line-height: 1.7; font-size: 1rem; margin-top: 0.75rem; }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.35rem 1rem;
      background: #E8621A;
      color: #fff;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="emoji">🥦</span>
    <h1>El Menú</h1>
    <p>Estamos realizando mejoras en el sitio.</p>
    <p>Volvemos muy pronto, ¡gracias por tu paciencia!</p>
    <span class="badge">En mantenimiento</span>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '3600',
      },
    }
  )
}

export const config = {
  // Aplica a todas las rutas excepto archivos estáticos de Next.js
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
