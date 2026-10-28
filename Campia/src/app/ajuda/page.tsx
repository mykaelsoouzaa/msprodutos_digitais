import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY } from '@/lib/company';
import { faqGroups, faqJsonLd } from '@/lib/faq';
import { safeJson } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Ajuda',
  description: 'Perguntas frequentes sobre a Campia: como organizar um campeonato, receber as inscrições, inscrever o time e acompanhar os jogos.',
  alternates: { canonical: '/ajuda' },
};

export default function Ajuda() {
  const groups = faqGroups();
  return (
    <div className="narrow">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(faqJsonLd(groups)) }} />
      <h1>Central de ajuda</h1>
      <p className="sub">As dúvidas mais comuns de quem organiza e de quem joga.</p>
      {groups.map(g => (
        <section key={g.title} style={{ marginTop: 20 }}>
          <h2>{g.title}</h2>
          <div className="faq">
            {g.items.map(i => (
              <details key={i.q} className="card faq-item">
                <summary>{i.q}</summary>
                <p>{i.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
        <b>Não achou a resposta?</b>
        <p className="sub" style={{ margin: '4px 0 10px' }}>Fale com a gente pelo e-mail ou pelo Instagram.</p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <a className="btn sm" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <Link className="btn ghost sm" href="/sobre">Sobre a Campia</Link>
        </div>
      </div>
    </div>
  );
}
