import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// JetBrains Mono cargada vía next/font — elimina el @import runtime de page.js (P4.2)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata = {
  title: 'UPAX Marketing Dashboard',
  description: 'Weekly marketing meeting system — Mkt Corp Upax',
  robots: { index: false, follow: false }, // P4.8: no indexar
  icons: { icon: '/favicon.svg' },
}

// P4.8: viewport separado de metadata (Next.js 14 lo requiere así)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body style={{ fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)", margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
