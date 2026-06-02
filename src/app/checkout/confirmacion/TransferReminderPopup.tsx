'use client'
import { useEffect, useState } from 'react'
import { X, MessageCircle } from 'lucide-react'

type Props = {
  orderId: string
  waNumber: string
}

export default function TransferReminderPopup({ orderId, waNumber }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  const shortId = orderId.slice(0, 8).toUpperCase()
  const msg = `Hola! Realicé el pedido #${shortId} y adjunto el comprobante de transferencia.`
  const href = `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => setVisible(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <div className="flex justify-end">
          <button
            onClick={() => setVisible(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Icon + title */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: '#FDE8D8' }}
          >
            <MessageCircle size={28} style={{ color: '#E8621A' }} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            ¡Recuerda enviar el comprobante!
          </h2>
          <p className="text-sm text-gray-600">
            Tu pedido <span className="font-semibold">#{shortId}</span> está registrado, pero
            lo procesamos recién cuando recibamos el comprobante de transferencia.
          </p>
        </div>

        {/* Steps */}
        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
          <li>Realiza la transferencia por el monto de tu pedido.</li>
          <li>Toma una captura del comprobante.</li>
          <li>Envíala por WhatsApp tocando el botón de abajo.</li>
        </ol>

        {/* CTA */}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setVisible(false)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-white text-sm font-semibold"
          style={{ background: '#E8621A' }}
        >
          <MessageCircle size={16} />
          Enviar comprobante por WhatsApp
        </a>

        <button
          onClick={() => setVisible(false)}
          className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1"
        >
          Ya lo envié, cerrar
        </button>
      </div>
    </div>
  )
}
