import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from './_components/AdminSidebar'

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F3F7F4' }}>
      <AdminSidebar userEmail={user.email ?? ''} />
      <main style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }} className="md:pb-0">
        {children}
      </main>
    </div>
  )
}
