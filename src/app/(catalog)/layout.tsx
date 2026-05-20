import CartDrawer from '@/components/catalog/CartDrawer'

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CartDrawer />
    </>
  )
}
