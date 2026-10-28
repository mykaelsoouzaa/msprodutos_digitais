import type { Metadata, Viewport } from 'next';
import ThemeToggle from '@/components/ThemeToggle';
import { THEME_SCRIPT } from '@/lib/theme';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import AccountMenu from '@/components/AccountMenu';
import InstagramIcon from '@/components/InstagramIcon';
import { COMPANY, instagramUrl } from '@/lib/company';
import { safeJson } from '@/lib/seo';
import { NAV_LINKS } from '@/lib/nav';
import PwaSetup from '@/components/PwaSetup';
import Splash from '@/components/Splash';
import { APP_VERSION } from '@/lib/version';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Campia · campeonatos organizados em 2 minutos', template: '%s · Campia' },
  description: 'Campeonatos amadores organizados em minutos: tabela automática, inscrição com PIX e resultados no WhatsApp.',
  applicationName: 'Campia',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://campia.app.br'),
  openGraph: { siteName: 'Campia', locale: 'pt_BR', type: 'website' },
  appleWebApp: { capable: true, title: 'Campia', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32' }, { url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f7f5' }, { media: '(prefers-color-scheme: dark)', color: '#0b1410' }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Splash />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson({
          '@context': 'https://schema.org', '@type': 'Organization', name: 'Campia', url: `https://${COMPANY.site}`,
          logo: `https://${COMPANY.site}/icons/icon-512.png`, email: COMPANY.email,
          sameAs: [instagramUrl(COMPANY.instagram)],
          parentOrganization: { '@type': 'Organization', name: COMPANY.name, sameAs: [instagramUrl(COMPANY.companyInstagram)] },
        }) }} />
        <header className="top">
          <div className="container">
            <Link href="/" className="brand" aria-label="Campia: início">
              <img src="/brand/campia-logo-escuro.svg" alt="Campia" height={30} className="logo-dark" />
              <img src="/brand/campia-logo-claro.svg" alt="Campia" height={30} className="logo-light" />
            </Link>
            <nav className="nav" aria-label="Principal">
              {NAV_LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            </nav>
            <span className="spacer" />
            <AccountMenu />
            <Link href="/painel/novo" className="btn sm cta-top">Criar campeonato</Link>
            <MobileNav />
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
            <span className="foot-logo">
              <img src="/brand/campia-logo-escuro.svg" alt="Campia" height={22} className="logo-dark" />
              <img src="/brand/campia-logo-claro.svg" alt="Campia" height={22} className="logo-light" />
            </span>
            <div className="foot-links">
              <Link href="/novidades" className="ver-chip"><span className="new" />v{APP_VERSION} · Novidades</Link>
              <Link href="/#como-funciona">Como funciona</Link>
              <Link href="/termos">Termos</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/sobre">Sobre</Link>
              <a href={instagramUrl(COMPANY.instagram)} target="_blank" rel="noopener" className="foot-ig" aria-label={`Instagram da Campia (@${COMPANY.instagram})`}><InstagramIcon /> @{COMPANY.instagram}</a>
              <a href={instagramUrl(COMPANY.companyInstagram)} target="_blank" rel="noopener" className="foot-company" aria-label={`${COMPANY.name} no Instagram (@${COMPANY.companyInstagram})`}>
                <InstagramIcon size={14} /><span>um produto <b>{COMPANY.name}</b></span>
              </a>
              <ThemeToggle />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
