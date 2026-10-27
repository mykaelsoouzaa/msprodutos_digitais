import Link from 'next/link';
import { COMPANY, LEGAL_UPDATED } from '@/lib/company';

/** Moldura das páginas de Termos e Privacidade. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="narrow legal">
      <Link href="/" className="back-link">‹ Início</Link>
      <h1>{title}</h1>
      <p className="sub">Última atualização: {LEGAL_UPDATED}</p>
      <div className="card legal-body">{children}</div>
      <p className="sub small" style={{ marginTop: 16 }}>
        {COMPANY.name}{COMPANY.cnpj ? ` · CNPJ ${COMPANY.cnpj}` : ''} · <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> ·{' '}
        <Link href="/termos">Termos de Uso</Link> · <Link href="/privacidade">Política de Privacidade</Link>
      </p>
    </article>
  );
}
