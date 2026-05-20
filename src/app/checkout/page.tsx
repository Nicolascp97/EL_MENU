import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/catalog/Navbar'
import CheckoutClient from '@/components/checkout/CheckoutClient'
import type { Zone, UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ delivery?: string; payment?: string }>

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const initialDelivery = params.delivery === 'tienda' ? 'tienda' : 'domicilio'
  const initialPayment = params.payment === 'transfer' ? 'transfer' : 'webpay'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialName: string | null = null
  let initialPhone: string | null = null
  let initialAddress: string | null = null
  let userRole: UserRole = 'minorista'

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone, address, role')
      .eq('id', user.id)
      .single()
    initialName = profile?.name ?? null
    initialPhone = profile?.phone ?? null
    initialAddress = profile?.address ?? null
    userRole = (profile?.role as UserRole) ?? 'minorista'
  }

  const { data: zones } = await supabase.from('zones').select('*').order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Finalizar pedido
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Revisa tu pedido, elige cómo recibirlo y paga con Transbank o transferencia.
          </p>
        </header>

        <CheckoutClient
          zones={(zones as Zone[]) ?? []}
          userRole={userRole}
          initialName={initialName}
          initialPhone={initialPhone}
          initialAddress={initialAddress}
          userEmail={user?.email ?? null}
          initialDelivery={initialDelivery}
          initialPayment={initialPayment}
        />
      </main>
    </div>
  )
}
