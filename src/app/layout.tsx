import type { Metadata } from 'next'
import { Inter, Fraunces, Dancing_Script } from 'next/font/google'
import './globals.css'
import ChatWidget from '@/components/chat/ChatWidget'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const dancing = Dancing_Script({ subsets: ['latin'], variable: '--font-dancing', display: 'swap', weight: ['700'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://elmenu.cl'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'El Menú · Verdulería fresca con despacho a domicilio',
    template: '%s · El Menú',
  },
  description:
    'Frutas y verduras frescas seleccionadas a mano, con despacho a domicilio en 27 comunas de Santiago. Mismo día si pediste antes de las 16:00.',
  keywords: [
    'verdulería a domicilio Santiago',
    'frutas y verduras frescas Macul',
    'despacho de verduras Ñuñoa',
    'verdulería online Región Metropolitana',
  ],
  authors: [{ name: 'El Menú', url: APP_URL }],
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: APP_URL,
    siteName: 'El Menú',
    title: 'El Menú · Verdulería fresca con despacho a domicilio',
    description:
      'Frutas y verduras frescas seleccionadas a mano, con despacho a domicilio en 27 comunas de Santiago.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'El Menú — Verdulería fresca con despacho a domicilio en Santiago',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'El Menú · Verdulería fresca con despacho a domicilio',
    description: 'Frutas y verduras frescas con despacho en 27 comunas de Santiago.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/logo/elmenu-sin-fondo.png',
    apple: '/logo/elmenu-sin-fondo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${inter.variable} ${fraunces.variable} ${dancing.variable}`}>
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {children}
        <ChatWidget />
      </body>
    </html>
  )
}
