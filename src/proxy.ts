import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Página 503 que se muestra a todos los visitantes cuando
 * MAINTENANCE_MODE=true está activo en Vercel.
 */
const MAINTENANCE_HTML = `<!DOCTYPE html>
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
</html>`

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Modo mantenimiento ──────────────────────────────────────────────────
  // Actívalo con MAINTENANCE_MODE=true en Vercel. Devuelve 503 a todos los
  // visitantes mientras el flag esté activo (API → JSON, web → página HTML).
  if (process.env.MAINTENANCE_MODE === 'true') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Sitio en mantenimiento. Vuelve pronto.' },
        { status: 503, headers: { 'Retry-After': '3600' } }
      )
    }
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '3600',
      },
    })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /admin → solo usuarios autenticados (la verificación de rol admin
  // se hace dentro de la página/route handler).
  // /login es la página de ingreso exclusiva para Celso (admin) — no redirigir ahí.
  if (pathname.startsWith('/admin') && pathname !== '/login' && !user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url)
    )
  }

  // /mayorista/* es PÚBLICO para ver (todos pueden navegar precios y categorías).
  // La capacidad de "comprar" se decide a nivel de ProductCard según el rol.

  // /mi-cuenta → perfil del usuario, protegido.
  if (pathname.startsWith('/mi-cuenta') && !user) {
    return NextResponse.redirect(
      new URL(`/mayorista/login?next=${encodeURIComponent(pathname)}`, request.url)
    )
  }

  return supabaseResponse
}

export const config = {
  // Patrón canónico de Supabase SSR: corremos en todas las rutas (para refrescar
  // tokens de sesión) excepto en estáticos. Las redirecciones se deciden por
  // path dentro de proxy().
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo|placeholders|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
