import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import PwaSetup from '@/components/PwaSetup';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Campia · campeonatos organizados em 2 minutos', template: '%s · Campia' },
  description: 'Campeonatos amadores organizados em minutos: tabela automática, inscrição com PIX e resultados no WhatsApp.',
  applicationName: 'Campia',
  appleWebApp: { capable: true, title: 'Campia', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32' }, { url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1410' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <header className="top">
            <Link href="/" className="brand" aria-label="Campia: início">
              <img src="/brand/campia-logo-escuro.svg" alt="Campia" height={32} style={{ display: 'block', height: 32, width: 'auto' }} />
            </Link>
            <span className="spacer" />
            <Link href="/painel" className="btn ghost sm">Painel</Link>
          </header>
          <main>
            <PwaSetup />
            {children}
          </main>
          <footer className="foot">Campia · campia.app.br · um produto MS Suporte TI</footer>
        </div>
      </body>
    </html>
  );
}
