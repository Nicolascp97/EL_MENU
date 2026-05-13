import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  if (pathname.startsWith('/admin') && !user) {
    return NextResponse.redirect(
      new URL(`/mayorista/login?next=${encodeURIComponent(pathname)}`, request.url)
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
