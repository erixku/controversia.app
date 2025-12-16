import React from 'react';
import './globals.css'
import type { Metadata } from 'next'
import { EB_Garamond, Syne } from 'next/font/google'
import { AuthProvider } from '../contexts/AuthContext'
import Navbar from '../components/Navbar'

const ebGaramond = EB_Garamond({ 
  subsets: ['latin'],
  variable: '--font-eb-garamond',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['400', '700', '800']
})

export const metadata: Metadata = {
  title: 'CONTROVERSIA',
  description: 'Um jogo de cartas minimalista e ousado.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${ebGaramond.variable} ${syne.variable}`}>
      <body className="bg-black text-white selection:bg-white selection:text-black font-serif min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-grow flex flex-col relative overflow-hidden">
            {children}
          </main>
          <footer className="py-6 border-t border-neutral-800 text-center text-neutral-500 text-sm italic">
             <p>© 2024 CONTROVERSIA. Todos os direitos reservados.</p>
          </footer>
        </body>
      </html>
    )
}