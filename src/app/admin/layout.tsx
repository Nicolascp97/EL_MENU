import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription, type SubscriptionInfo } from '@/lib/subscription'
import AdminSidebar from './_components/AdminSidebar'
import SubscriptionNotice from './_components/SubscriptionNotice'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Aviso de cobro. FAIL-OPEN: si falla la lectura (tabla ausente, env faltante,
  // error de red), se omite el aviso y el panel funciona normal. NUNCA debe tumbar
  // el panel de admin.
  let subscription: SubscriptionInfo | null = null
  try {
    subscription = await getSubscription()
  } catch (err) {
    console.error('[subscription] no se pudo leer, se omite el aviso:', err)
  }
  const payLink = process.env.NEXT_PUBLIC_MP_PAYMENT_LINK ?? ''

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F3F7F4' }}>
      <AdminSidebar userEmail={user.email ?? ''} />
      <main style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }} className="md:pb-0">
        {subscription && payLink && (
          <SubscriptionNotice
            state={subscription.state}
            daysUntilDue={subscription.daysUntilDue}
            amount={subscription.amountClp}
            nextDueDate={subscription.nextDueDate}
            payLink={payLink}
          />
        )}
        {children}
      </main>
    </div>
  )
}
