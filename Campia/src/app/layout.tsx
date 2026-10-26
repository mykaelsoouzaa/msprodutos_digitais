import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import PwaSetup from '@/components/PwaSetup';
import Splash from '@/components/Splash';
import { APP_VERSION } from '@/lib/version';
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
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Splash />
        <header className="top">
          <div className="container">
            <Link href="/" className="brand" aria-label="Campia: início">
              <img src="/brand/campia-logo-escuro.svg" alt="Campia" height={30} />
            </Link>
            <nav className="nav" aria-label="Principal">
              <Link href="/campeonatos">Campeonatos</Link>
              <Link href="/#como-funciona">Como funciona</Link>
              <Link href="/#esportes">Esportes</Link>
              <Link href="/novidades">Novidades</Link>
            </nav>
            <span className="spacer" />
            <Link href="/painel" className="btn ghost sm">Painel</Link>
            <Link href="/painel/novo" className="btn sm cta-top">Criar campeonato</Link>
          </div>
        </header>
        <main>
          <div className="container">
            <PwaSetup />
            {children}
          </div>
        </main>
        <footer className="foot">
          <div className="container">
            <img src="/brand/campia-logo-escuro.svg" alt="Campia" height={22} />
            <div className="foot-links">
              <Link href="/novidades" className="ver-chip"><span className="new" />v{APP_VERSION} · Novidades</Link>
              <span>campia.app.br</span>
              <span>um produto MS Suporte TI</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
