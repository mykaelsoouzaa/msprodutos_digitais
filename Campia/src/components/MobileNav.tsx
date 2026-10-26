'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/nav';


/** Menu do celular. Fecha sozinho ao trocar de página (o `key` recria o elemento). */
export default function MobileNav() {
  const path = usePathname();
  return (
    <details className="mnav" key={path}>
      <summary aria-label="Abrir menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </summary>
      <nav className="mnav-panel" aria-label="Menu">
        {NAV_LINKS.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>)}
        <Link href="/painel">Painel do organizador</Link>
        <Link href="/painel/novo" className="btn">Criar campeonato</Link>
      </nav>
    </details>
  );
}
