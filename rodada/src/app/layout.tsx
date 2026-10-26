import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import PwaSetup from '@/components/PwaSetup';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Rodada', template: '%s · Rodada' },
  description: 'Campeonatos amadores organizados em minutos: tabela automática, inscrição com PIX e resultados no WhatsApp.',
  applicationName: 'Rodada',
  appleWebApp: { capable: true, title: 'Rodada', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1410' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <header className="top">
            <Link href="/" className="logo" aria-label="Início">R</Link>
            <Link href="/" className="brand">Rodada</Link>
            <span className="spacer" />
            <Link href="/painel" className="btn ghost sm">Painel</Link>
          </header>
          <main>
            <PwaSetup />
            {children}
          </main>
          <footer className="foot">Rodada · um produto MS Suporte TI</footer>
        </div>
      </body>
    </html>
  );
}
