'use client'
import { useEffect } from 'react'
import { useCart } from '@/hooks/useCart'

/**
 * Limpia el carrito una sola vez cuando el pedido quedó efectivamente registrado:
 * - status=success  → pago Webpay confirmado
 * - status=transfer → pedido por transferencia registrado
 *
 * En cancelado/fallido/error NO se limpia, para que el cliente conserve su
 * carrito y pueda reintentar el pago sin tener que volver a armarlo.
 */
export default function ClearCartOnConfirm({ status }: { status: string }) {
  const clearCart = useCart(s => s.clearCart)

  useEffect(() => {
    if (status === 'success' || status === 'transfer') {
      clearCart()
    }
  }, [status, clearCart])

  return null
}
